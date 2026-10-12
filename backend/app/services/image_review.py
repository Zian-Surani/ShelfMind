"""Product-specific, evidence-backed image count decisions; no supplier dispatch."""
from collections import Counter
from datetime import timedelta, timezone
from decimal import Decimal

import numpy as np
from mdptoolbox.mdp import ValueIteration
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DataSource, Decision, DecisionEvaluation, Product, RetailHistoryRow, ShelfObservation, Store, utcnow
from app.services.preferences import store_preferences
from app.services.retail import audit, latest_store
from app.services.serializers import decision_to_frontend


def product_history(db: Session, store_id: str, product_id: str):
    return list(reversed(db.scalars(select(RetailHistoryRow).where(
        RetailHistoryRow.store_id == store_id, RetailHistoryRow.product_id == product_id
    ).order_by(RetailHistoryRow.observed_on.desc()).limit(90)).all()))


def evaluate_count(product: Product, count: int, history):
    capacity, lead = product.storage_capacity, product.supplier.default_lead_time_days
    if not 0 <= count <= capacity:
        raise ValueError(f"Verified quantity must be between 0 and this item's capacity ({capacity}).")
    if capacity > 250 or not 0 <= lead <= 14:
        raise ValueError("This evaluator supports capacities up to 250 and lead times up to 14 days.")
    # One decision period covers lead time, then one selling day after arrival.
    samples = []
    for start in range(len(history) - lead):
        block = history[start:start + lead + 1]
        if all(row.observed_on == block[0].observed_on + timedelta(days=index) for index, row in enumerate(block)):
            samples.append((sum(int(row.raw_values["demand"]) for row in block[:-1]), int(block[-1].raw_values["demand"])))
    if len(samples) < 2:
        raise ValueError("At least two complete lead-time demand windows are required for this item ID.")
    demand_distribution = Counter(samples)
    actions = list(range(0, capacity + 1, product.minimum_order_quantity))
    states = np.arange(capacity + 1)
    transitions = np.zeros((len(actions), len(states), len(states)))
    rewards = np.zeros((len(states), len(actions)))
    price, cost = float(product.selling_price), float(product.purchase_cost)
    holding_cost = round(max(0.01, cost * 0.02), 4)
    shortage_cost = max(1.0, price - cost)
    setup_cost, discount = cost, 0.92
    for action_index, quantity in enumerate(actions):
        for (lead_demand, next_day_demand), frequency in demand_distribution.items():
            probability = frequency / len(samples)
            before_receipt = np.maximum(0, states - lead_demand)
            after_receipt = np.minimum(capacity, before_receipt + quantity)
            next_state = np.maximum(0, after_receipt - next_day_demand)
            sold = np.minimum(states, lead_demand) + np.minimum(after_receipt, next_day_demand)
            shortage = np.maximum(0, lead_demand - states) + np.maximum(0, next_day_demand - after_receipt)
            transitions[action_index, states, next_state] += probability
            rewards[:, action_index] += probability * (sold * price - quantity * cost
                - (setup_cost if quantity else 0) - next_state * holding_cost * (lead + 1) - shortage * shortage_cost)
        rewards[states + quantity > capacity, action_index] = -1e9
    engine = ValueIteration(transitions, rewards, discount, epsilon=0.001, max_iter=1000)
    engine.run()
    values = np.asarray(engine.V)
    q_values = rewards.T + discount * np.einsum("ask,k->as", transitions, values)
    policy = q_values.argmax(axis=0)
    scores = [{"quantity": quantity, "value": round(float(q_values[index, count]), 4),
               "immediateReward": round(float(rewards[count, index]), 4)}
              for index, quantity in enumerate(actions) if count + quantity <= capacity]
    scores.sort(key=lambda row: (-row["value"], row["quantity"]))
    target = actions[int(policy[0])]
    order = scores[0]["quantity"]
    direction = "MORE" if order else "LESS" if count > target else "ENOUGH"
    shortage_probability = sum(freq for (demand, _), freq in demand_distribution.items() if demand > count) / len(samples)
    span_residual = float(np.ptp(q_values.max(axis=0) - values))
    return {"direction": direction, "orderQuantity": order, "targetQuantity": target,
            "excessQuantity": max(0, count - target), "verifiedQuantity": count,
            "dailyDemand": round(float(np.mean([int(row.raw_values["demand"]) for row in history[-28:]])), 2),
            "leadTimeDays": lead, "capacity": capacity, "minimumOrderQuantity": product.minimum_order_quantity,
            "historySamples": len(samples), "lastHistoryDate": history[-1].observed_on.isoformat(),
            "stockoutProbability": round(shortage_probability, 4), "actions": scores,
            "iterations": engine.iter, "discount": discount,
            "converged": span_residual < 0.001 * (1 - discount) / discount,
            "residual": round(span_residual, 8), "algorithm": "Value iteration / empirical demand",
            "assumptions": {"holdingCostPerUnitDay": holding_cost, "lostSalePenaltyPerUnit": shortage_cost,
                            "orderSetupCost": setup_cost, "periodDays": lead + 1,
                            "orderArrival": "After supplier lead time; no outstanding deliveries modeled",
                            "costBasis": "Holding: 2% of purchase cost/day; shortage: unit margin (minimum 1); setup: one unit cost"}}


def review_decision(db: Session, payload):
    store = latest_store(db)
    db.execute(select(Store).where(Store.id == store.id).with_for_update())
    decision_id = f"imgdec-{payload.request_id}"
    evidence_ids = sorted(set(payload.image_ids))
    existing = db.get(Decision, decision_id)
    if existing:
        review = existing.state_payload.get("imageReview", {})
        if existing.product_id != payload.product_id or existing.current_stock != payload.confirmed_quantity or review.get("imageIds") != evidence_ids:
            raise ValueError("This request ID was already used for a different review.")
        return decision_to_frontend(existing)
    product = db.get(Product, payload.product_id)
    if not product:
        raise ValueError("Unknown item ID. Select an item with saved demand history.")
    images = list(db.scalars(select(ShelfObservation).where(ShelfObservation.store_id == store.id,
                                                        ShelfObservation.id.in_(evidence_ids))))
    if len(images) != len(evidence_ids):
        raise ValueError("One or more selected images were not found in this store.")
    history = product_history(db, store.id, product.id)
    model = evaluate_count(product, payload.confirmed_quantity, history)
    sources = list(db.scalars(select(DataSource).where(DataSource.id.in_({row.source_id for row in history}))))
    generated = any(source.generated for source in sources)
    quality_ok = all(image.detection_payload.get("quality", {}).get("status") == "CLEAR" for image in images)
    image_fresh = all((utcnow() - image.observed_at.replace(tzinfo=timezone.utc)).total_seconds() <= 86400 for image in images)
    preferences = store_preferences(db, store)
    quantity = model["orderQuantity"]
    spend = round(quantity * float(product.purchase_cost), 2)
    checks = [
        {"label": "Auto-approval enabled", "passed": preferences["autonomyMode"] == "AUTO_UNDER_THRESHOLD"},
        {"label": "Image quality checks passed", "passed": quality_ok},
        {"label": "Uploads reviewed within 24 hours", "passed": image_fresh},
        {"label": "At least 14 demand windows", "passed": model["historySamples"] >= 14},
        {"label": "History no more than 7 days old", "passed": (utcnow().date() - history[-1].observed_on).days <= 7},
        {"label": "MDP converged", "passed": model["converged"]},
        {"label": f"Quantity within {preferences['maxAutoQuantity']} units", "passed": quantity <= preferences["maxAutoQuantity"]},
        {"label": f"Spend within {preferences['maxAutoSpend']}", "passed": spend <= preferences["maxAutoSpend"]},
    ]
    auto = all(check["passed"] for check in checks)
    action = "BUY" if quantity else "REDUCE" if model["direction"] == "LESS" else "HOLD"
    reason = (f"{payload.confirmed_quantity} verified available units; {model['dailyDemand']} units/day in saved history. "
              f"The MDP selected {'BUY ' + str(quantity) if quantity else 'HOLD replenishment'} across {len(model['actions'])} feasible actions. "
              f"{'Above' if model['direction'] == 'LESS' else 'Policy'} target: {model['targetQuantity']} units. "
              f"{'Simulated' if generated else 'Imported operational'} demand history; approval records a recommendation, not a supplier order.")
    # A new count invalidates only older pending image-based recommendations.
    for old in db.scalars(select(Decision).where(Decision.store_id == store.id, Decision.product_id == product.id,
                                                Decision.status == "APPROVAL_REQUIRED").with_for_update()):
        if old.state_payload.get("imageReview"):
            old.status = "SUPERSEDED"
            old.execution_note = "Replaced by a newer verified image count."
    review = {"imageIds": evidence_ids, "verifiedBy": store.manager_name,
              "quantityScope": "Total available stock explicitly confirmed by manager; images alone are not SKU identification",
              "imageQualityPassed": quality_ok, "historyGenerated": generated,
              "historySources": [source.source_name for source in sources], "autoChecks": checks,
              "estimatedSpend": spend, "assessment": model}
    decision = Decision(id=decision_id, store_id=store.id, product_id=product.id, engine="VALUE_ITERATION",
        action=action, quantity=quantity, shelf_action="MAINTAIN", status="AUTO_EXECUTED" if auto else "APPROVAL_REQUIRED",
        current_stock=payload.confirmed_quantity, expected_demand=Decimal(str(model["dailyDemand"])),
        supplier_lead_time_days=product.supplier.default_lead_time_days,
        stockout_risk=Decimal(str(model["stockoutProbability"])), risk_score=Decimal(str(model["stockoutProbability"])),
        confidence=Decimal("0"), reason=reason,
        state_payload={"inventory": payload.confirmed_quantity, "demand": "NORMAL", "leadTimeDays": product.supplier.default_lead_time_days,
                       "shelfCapacity": product.shelf_capacity, "imageReview": review},
        recommendation_payload={"original_quantity": quantity, "original_action": action,
                                "expected_reward": model["actions"][0]["value"]},
        execution_note="Auto-approved recommendation only; no supplier order sent." if auto else "Awaiting manager approval.")
    db.add(decision)
    for index, row in enumerate(model["actions"]):
        decision.evaluations.append(DecisionEvaluation(action_label=f"Buy {row['quantity']}" if row["quantity"] else "Hold",
            order_quantity=row["quantity"], shelf_delta=0, action_value=Decimal(str(row["value"])), is_optimal=index == 0,
            reward_components={"immediateReward": row["immediateReward"]}))
    db.flush()
    audit(db, store.id, "IMAGE_REVIEW", "MDP", f"{store.manager_name} verified {payload.confirmed_quantity} units for {product.id}.",
          decision_id=decision_id, outcome_status="SUCCESS" if auto else "NEEDS_REVIEW",
          outcome_label=reason, details={"imageIds": evidence_ids, "quantity": payload.confirmed_quantity})
    db.commit()
    db.refresh(decision)
    return decision_to_frontend(decision)


def product_review_history(db: Session, product_id: str):
    store = latest_store(db)
    product = db.get(Product, product_id)
    if not product:
        raise ValueError("Unknown item ID")
    history = product_history(db, store.id, product_id)
    sources = list(db.scalars(select(DataSource).where(DataSource.id.in_({row.source_id for row in history}))))
    decisions = list(db.scalars(select(Decision).where(Decision.store_id == store.id, Decision.product_id == product_id)
                               .order_by(Decision.recommended_at.desc()).limit(100)))
    reviews = [decision_to_frontend(decision) for decision in decisions if decision.state_payload.get("imageReview")]
    return {"productId": product_id, "name": product.name, "capacity": product.storage_capacity,
            "historyGenerated": any(source.generated for source in sources),
            "history": [{"date": row.observed_on.isoformat(), "demand": int(row.raw_values["demand"]),
                         "sold": int(row.raw_values["units_sold"])} for row in history[-30:]],
            "reviews": reviews}
