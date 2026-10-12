from __future__ import annotations

import math
import random
import time
from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Any, Protocol

import numpy as np


INVENTORY_BUCKETS = ("LOW", "MEDIUM", "HIGH", "OVERSTOCK")
DEMAND_REGIMES = ("LOW", "NORMAL", "HIGH", "SPIKE")
LEAD_TIME_BUCKETS = (1, 2, 3, 4)
SHELF_BUCKETS = ("LOW", "NORMAL", "HIGH")
COMPETITION_BUCKETS = ("LOW", "NORMAL", "HIGH")
ORDER_QUANTITIES = (0, 8, 16, 24, 32)
SHELF_DELTAS = (-1, 0, 1)


@dataclass(frozen=True)
class RetailState:
    inventory_bucket: str
    demand_regime: str
    lead_time_days: int
    shelf_bucket: str
    competitor_pressure: str


@dataclass(frozen=True)
class RetailAction:
    order_quantity: int
    shelf_delta: int = 0

    @property
    def label(self) -> str:
        if self.order_quantity <= 0:
            order = "Hold"
        else:
            order = f"Buy {self.order_quantity}"
        if self.shelf_delta > 0:
            return f"{order} / Increase shelf"
        if self.shelf_delta < 0:
            return f"{order} / Reduce shelf"
        return order


@dataclass
class RewardBreakdown:
    revenue_reward: float
    ordering_penalty: float
    holding_penalty: float
    stockout_penalty: float
    wastage_penalty: float
    shelf_penalty: float
    total_reward: float


@dataclass
class TrainingResult:
    algorithm: str
    seed: int
    number_of_states: int
    number_of_actions: int
    iterations: int
    converged: bool
    runtime_ms: int
    hyperparameters: dict[str, Any]
    environment_config: dict[str, Any]
    metrics: dict[str, float]
    policy: dict[str, str]


class DecisionEngine(Protocol):
    algorithm: str

    def run_training(self, *args: Any, **kwargs: Any) -> TrainingResult:
        ...

    def evaluate_actions(self, state: RetailState, product_profile: dict[str, float] | None = None) -> list[dict[str, Any]]:
        ...

    def get_action(self, state: RetailState, product_profile: dict[str, float] | None = None) -> dict[str, Any]:
        ...


def all_states() -> list[RetailState]:
    return [
        RetailState(inv, demand, lead, shelf, comp)
        for inv in INVENTORY_BUCKETS
        for demand in DEMAND_REGIMES
        for lead in LEAD_TIME_BUCKETS
        for shelf in SHELF_BUCKETS
        for comp in COMPETITION_BUCKETS
    ]


def all_actions() -> list[RetailAction]:
    return [RetailAction(qty, delta) for qty in ORDER_QUANTITIES for delta in SHELF_DELTAS]


def state_key(state: RetailState) -> str:
    return "|".join(
        [
            state.inventory_bucket,
            state.demand_regime,
            str(state.lead_time_days),
            state.shelf_bucket,
            state.competitor_pressure,
        ]
    )


def action_key(action: RetailAction) -> str:
    return f"{action.order_quantity}:{action.shelf_delta}"


def action_from_key(key: str) -> RetailAction:
    qty, delta = key.split(":")
    return RetailAction(int(qty), int(delta))


def expected_demand_units(state: RetailState, product_profile: dict[str, float] | None = None) -> float:
    base = (product_profile or {}).get("base_daily_demand", 12.0)
    regime_multiplier = {"LOW": 0.65, "NORMAL": 1.0, "HIGH": 1.35, "SPIKE": 1.9}[state.demand_regime]
    comp_multiplier = {"LOW": 0.9, "NORMAL": 1.0, "HIGH": 1.12}[state.competitor_pressure]
    shelf_multiplier = {"LOW": 0.88, "NORMAL": 1.0, "HIGH": 1.08}[state.shelf_bucket]
    return base * regime_multiplier * comp_multiplier * shelf_multiplier


def inventory_midpoint(bucket: str) -> int:
    return {"LOW": 8, "MEDIUM": 22, "HIGH": 42, "OVERSTOCK": 68}[bucket]


def bucket_inventory(units: float, storage_capacity: int = 80) -> str:
    if units < 0.25 * storage_capacity:
        return "LOW"
    if units < 0.55 * storage_capacity:
        return "MEDIUM"
    if units < 0.9 * storage_capacity:
        return "HIGH"
    return "OVERSTOCK"


def bucket_shelf(fill_ratio: float) -> str:
    if fill_ratio < 0.35:
        return "LOW"
    if fill_ratio <= 0.85:
        return "NORMAL"
    return "HIGH"


def regime_transition(regime: str) -> list[tuple[str, float]]:
    transitions = {
        "LOW": [("LOW", 0.62), ("NORMAL", 0.32), ("HIGH", 0.06)],
        "NORMAL": [("LOW", 0.12), ("NORMAL", 0.62), ("HIGH", 0.22), ("SPIKE", 0.04)],
        "HIGH": [("NORMAL", 0.34), ("HIGH", 0.50), ("SPIKE", 0.16)],
        "SPIKE": [("NORMAL", 0.44), ("HIGH", 0.42), ("SPIKE", 0.14)],
    }
    return transitions[regime]


def next_shelf_bucket(shelf: str, delta: int) -> str:
    idx = SHELF_BUCKETS.index(shelf)
    idx = max(0, min(len(SHELF_BUCKETS) - 1, idx + delta))
    return SHELF_BUCKETS[idx]


def reward_for(
    state: RetailState,
    action: RetailAction,
    product_profile: dict[str, float] | None = None,
) -> RewardBreakdown:
    profile = product_profile or {}
    price = profile.get("selling_price", 24.0)
    cost = profile.get("purchase_cost", 12.0)
    holding_cost = profile.get("holding_cost", 0.45)
    stockout_penalty = profile.get("stockout_penalty", 9.0)
    ordering_setup_cost = profile.get("order_setup_cost", 18.0)
    shelf_penalty_rate = profile.get("shelf_penalty", 2.5)
    capacity = int(profile.get("storage_capacity", 80))

    inventory = inventory_midpoint(state.inventory_bucket)
    demand = expected_demand_units(state, profile) * max(1, state.lead_time_days)
    future_inventory = min(capacity + 20, inventory + action.order_quantity)
    expected_sales = min(demand, future_inventory)
    lost_sales = max(0.0, demand - future_inventory)
    remaining = max(0.0, future_inventory - expected_sales)
    over_capacity = max(0.0, remaining - capacity)
    shelf_constraint = max(0, action.shelf_delta + SHELF_BUCKETS.index(state.shelf_bucket) - 2)

    revenue_reward = expected_sales * price
    ordering_penalty = (action.order_quantity * cost) + (ordering_setup_cost if action.order_quantity > 0 else 0)
    holding_penalty = remaining * holding_cost
    stockout_cost = lost_sales * stockout_penalty
    wastage_penalty = over_capacity * (cost * 0.65)
    shelf_penalty = shelf_constraint * shelf_penalty_rate
    total = revenue_reward - ordering_penalty - holding_penalty - stockout_cost - wastage_penalty - shelf_penalty
    return RewardBreakdown(
        revenue_reward=round(revenue_reward, 4),
        ordering_penalty=round(ordering_penalty, 4),
        holding_penalty=round(holding_penalty, 4),
        stockout_penalty=round(stockout_cost, 4),
        wastage_penalty=round(wastage_penalty, 4),
        shelf_penalty=round(shelf_penalty, 4),
        total_reward=round(total, 4),
    )


def transition_model(
    state: RetailState,
    action: RetailAction,
    product_profile: dict[str, float] | None = None,
) -> list[tuple[RetailState, float]]:
    profile = product_profile or {}
    inventory = inventory_midpoint(state.inventory_bucket)
    expected_daily = expected_demand_units(state, profile)
    projected = max(0, inventory + action.order_quantity - expected_daily)
    inv_bucket = bucket_inventory(projected, int(profile.get("storage_capacity", 80)))
    shelf_bucket = next_shelf_bucket(state.shelf_bucket, action.shelf_delta)

    comp = state.competitor_pressure
    if action.shelf_delta > 0 and state.demand_regime in {"HIGH", "SPIKE"}:
        comp = "HIGH"
    elif action.shelf_delta < 0:
        comp = "LOW"

    next_lead = max(1, min(4, state.lead_time_days - 1 if action.order_quantity > 0 else state.lead_time_days))
    return [
        (RetailState(inv_bucket, next_regime, next_lead, shelf_bucket, comp), probability)
        for next_regime, probability in regime_transition(state.demand_regime)
    ]


class ValueIterationEngine:
    algorithm = "VALUE_ITERATION"

    def __init__(self, gamma: float = 0.92, threshold: float = 1e-4, max_iterations: int = 100) -> None:
        self.gamma = gamma
        self.threshold = threshold
        self.max_iterations = max_iterations
        self.states = all_states()
        self.actions = all_actions()
        self.values: dict[str, float] = {state_key(s): 0.0 for s in self.states}
        self.policy: dict[str, str] = {}
        self.last_metrics: dict[str, float] = {}

    def run_training(
        self,
        seed: int = 20260914,
        product_profile: dict[str, float] | None = None,
        max_iterations: int | None = None,
    ) -> TrainingResult:
        random.seed(seed)
        start = time.perf_counter()
        limit = max_iterations or self.max_iterations
        converged = False
        residual = math.inf

        for iteration in range(1, limit + 1):
            new_values: dict[str, float] = {}
            residual = 0.0
            for state in self.states:
                state_values = [self._action_value(state, action, product_profile) for action in self.actions]
                best_value = max(state_values)
                new_values[state_key(state)] = best_value
                residual = max(residual, abs(best_value - self.values[state_key(state)]))
            self.values = new_values
            if residual < self.threshold:
                converged = True
                break

        for state in self.states:
            scored = [(self._action_value(state, action, product_profile), action) for action in self.actions]
            best_action = max(scored, key=lambda item: item[0])[1]
            self.policy[state_key(state)] = action_key(best_action)

        runtime_ms = int((time.perf_counter() - start) * 1000)
        avg_value = float(np.mean(list(self.values.values())))
        self.last_metrics = {"bellman_residual": residual, "average_state_value": avg_value}
        return TrainingResult(
            algorithm=self.algorithm,
            seed=seed,
            number_of_states=len(self.states),
            number_of_actions=len(self.actions),
            iterations=iteration,
            converged=converged,
            runtime_ms=runtime_ms,
            hyperparameters={"gamma": self.gamma, "threshold": self.threshold, "max_iterations": limit},
            environment_config=environment_config(),
            metrics=self.last_metrics,
            policy={k: RetailAction(*map(int, v.split(":"))).label for k, v in list(self.policy.items())[:25]},
        )

    def _action_value(
        self,
        state: RetailState,
        action: RetailAction,
        product_profile: dict[str, float] | None = None,
    ) -> float:
        reward = reward_for(state, action, product_profile).total_reward
        future_value = sum(
            probability * self.values.get(state_key(next_state), 0.0)
            for next_state, probability in transition_model(state, action, product_profile)
        )
        return reward + self.gamma * future_value

    def evaluate_actions(
        self,
        state: RetailState,
        product_profile: dict[str, float] | None = None,
    ) -> list[dict[str, Any]]:
        if not self.policy:
            self.run_training(product_profile=product_profile)
        rows = []
        for action in self.actions:
            reward = reward_for(state, action, product_profile)
            value = self._action_value(state, action, product_profile)
            rows.append(
                {
                    "action": action.label,
                    "quantity": action.order_quantity,
                    "shelf_delta": action.shelf_delta,
                    "value": round(value, 4),
                    "reward_components": asdict(reward),
                }
            )
        best = max(rows, key=lambda row: row["value"])
        for row in rows:
            row["isOptimal"] = row is best
        return sorted(rows, key=lambda row: row["value"], reverse=True)

    def get_action(
        self,
        state: RetailState,
        product_profile: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        evaluated = self.evaluate_actions(state, product_profile)
        return evaluated[0]


class QLearningEngine:
    algorithm = "Q_LEARNING"

    def __init__(self, alpha: float = 0.22, gamma: float = 0.91, epsilon: float = 0.35, epsilon_decay: float = 0.996):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.states = all_states()
        self.actions = all_actions()
        self.q_table: dict[tuple[str, str], float] = {
            (state_key(state), action_key(action)): 0.0 for state in self.states for action in self.actions
        }
        self.rng = random.Random(20260914)

    def run_training(
        self,
        episodes: int = 400,
        seed: int = 20260914,
        product_profile: dict[str, float] | None = None,
    ) -> TrainingResult:
        self.rng = random.Random(seed)
        start = time.perf_counter()
        total_reward = 0.0
        epsilon = self.epsilon
        for episode in range(episodes):
            state = self.rng.choice(self.states)
            for _ in range(18):
                action = self._choose_action(state, epsilon)
                reward = reward_for(state, action, product_profile).total_reward
                next_state = self._sample_next_state(state, action, product_profile)
                best_next = max(self.q_table[(state_key(next_state), action_key(a))] for a in self.actions)
                key = (state_key(state), action_key(action))
                self.q_table[key] += self.alpha * (reward + self.gamma * best_next - self.q_table[key])
                total_reward += reward
                state = next_state
            epsilon *= self.epsilon_decay

        runtime_ms = int((time.perf_counter() - start) * 1000)
        policy = {}
        for state in self.states[:25]:
            best_action = self._best_action(state)
            policy[state_key(state)] = best_action.label

        return TrainingResult(
            algorithm=self.algorithm,
            seed=seed,
            number_of_states=len(self.states),
            number_of_actions=len(self.actions),
            iterations=episodes,
            converged=True,
            runtime_ms=runtime_ms,
            hyperparameters={
                "alpha": self.alpha,
                "gamma": self.gamma,
                "epsilon": self.epsilon,
                "epsilon_decay": self.epsilon_decay,
                "episodes": episodes,
            },
            environment_config=environment_config(),
            metrics={
                "average_episode_reward": round(total_reward / max(1, episodes), 4),
                "final_epsilon": round(epsilon, 5),
            },
            policy=policy,
        )

    def _choose_action(self, state: RetailState, epsilon: float) -> RetailAction:
        if self.rng.random() < epsilon:
            return self.rng.choice(self.actions)
        return self._best_action(state)

    def _best_action(self, state: RetailState) -> RetailAction:
        return max(self.actions, key=lambda action: self.q_table[(state_key(state), action_key(action))])

    def _sample_next_state(
        self, state: RetailState, action: RetailAction, product_profile: dict[str, float] | None = None
    ) -> RetailState:
        sample = self.rng.random()
        cumulative = 0.0
        for next_state, probability in transition_model(state, action, product_profile):
            cumulative += probability
            if sample <= cumulative:
                return next_state
        return transition_model(state, action, product_profile)[-1][0]

    def evaluate_actions(
        self,
        state: RetailState,
        product_profile: dict[str, float] | None = None,
    ) -> list[dict[str, Any]]:
        if not any(self.q_table[(state_key(state), action_key(action))] for action in self.actions):
            self.run_training(product_profile=product_profile)
        rows = []
        for action in self.actions:
            reward = reward_for(state, action, product_profile)
            rows.append(
                {
                    "action": action.label,
                    "quantity": action.order_quantity,
                    "shelf_delta": action.shelf_delta,
                    "value": round(self.q_table[(state_key(state), action_key(action))], 4),
                    "reward_components": asdict(reward),
                }
            )
        best = max(rows, key=lambda row: row["value"])
        for row in rows:
            row["isOptimal"] = row is best
        return sorted(rows, key=lambda row: row["value"], reverse=True)

    def get_action(
        self,
        state: RetailState,
        product_profile: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        return self.evaluate_actions(state, product_profile)[0]


class DQNEngine:
    algorithm = "DQN"

    def __init__(self, gamma: float = 0.90, learning_rate: float = 0.003, batch_size: int = 32):
        import torch
        import torch.nn as nn

        self.torch = torch
        self.nn = nn
        torch.set_num_threads(1)
        self.gamma = gamma
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.states = all_states()
        self.actions = all_actions()
        self.rng = random.Random(20260914)
        self.model = nn.Sequential(nn.Linear(5, 48), nn.ReLU(), nn.Linear(48, 48), nn.ReLU(), nn.Linear(48, len(self.actions)))
        self.target_model = nn.Sequential(
            nn.Linear(5, 48), nn.ReLU(), nn.Linear(48, 48), nn.ReLU(), nn.Linear(48, len(self.actions))
        )
        self.target_model.load_state_dict(self.model.state_dict())
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        self.loss_fn = nn.SmoothL1Loss()
        self.memory: list[tuple[RetailState, int, float, RetailState]] = []

    def run_training(
        self,
        episodes: int = 24,
        seed: int = 20260914,
        product_profile: dict[str, float] | None = None,
    ) -> TrainingResult:
        torch = self.torch
        self.rng = random.Random(seed)
        torch.manual_seed(seed)
        start = time.perf_counter()
        epsilon = 0.45
        losses: list[float] = []
        reward_total = 0.0

        for episode in range(episodes):
            state = self.rng.choice(self.states)
            for _ in range(14):
                action_index = self._choose_action_index(state, epsilon)
                action = self.actions[action_index]
                reward = reward_for(state, action, product_profile).total_reward
                next_state = QLearningEngine()._sample_next_state(state, action, product_profile)
                self.memory.append((state, action_index, reward, next_state))
                if len(self.memory) > 2000:
                    self.memory.pop(0)
                if len(self.memory) >= self.batch_size:
                    losses.append(self._learn_batch())
                reward_total += reward
                state = next_state
            epsilon = max(0.04, epsilon * 0.982)
            if episode % 10 == 0:
                self.target_model.load_state_dict(self.model.state_dict())

        runtime_ms = int((time.perf_counter() - start) * 1000)
        policy = {state_key(state): self.actions[self._best_action_index(state)].label for state in self.states[:25]}
        return TrainingResult(
            algorithm=self.algorithm,
            seed=seed,
            number_of_states=len(self.states),
            number_of_actions=len(self.actions),
            iterations=episodes,
            converged=True,
            runtime_ms=runtime_ms,
            hyperparameters={
                "gamma": self.gamma,
                "learning_rate": self.learning_rate,
                "batch_size": self.batch_size,
                "episodes": episodes,
            },
            environment_config=environment_config(),
            metrics={
                "average_episode_reward": round(reward_total / max(1, episodes), 4),
                "final_loss": round(float(losses[-1]) if losses else 0.0, 6),
                "final_epsilon": round(epsilon, 5),
            },
            policy=policy,
        )

    def _state_tensor(self, state: RetailState):
        torch = self.torch
        values = [
            INVENTORY_BUCKETS.index(state.inventory_bucket) / (len(INVENTORY_BUCKETS) - 1),
            DEMAND_REGIMES.index(state.demand_regime) / (len(DEMAND_REGIMES) - 1),
            (state.lead_time_days - 1) / 3,
            SHELF_BUCKETS.index(state.shelf_bucket) / (len(SHELF_BUCKETS) - 1),
            COMPETITION_BUCKETS.index(state.competitor_pressure) / (len(COMPETITION_BUCKETS) - 1),
        ]
        return torch.tensor(values, dtype=torch.float32)

    def _choose_action_index(self, state: RetailState, epsilon: float) -> int:
        if self.rng.random() < epsilon:
            return self.rng.randrange(len(self.actions))
        return self._best_action_index(state)

    def _best_action_index(self, state: RetailState) -> int:
        torch = self.torch
        with torch.no_grad():
            q_values = self.model(self._state_tensor(state))
        return int(torch.argmax(q_values).item())

    def _learn_batch(self) -> float:
        torch = self.torch
        batch = self.rng.sample(self.memory, self.batch_size)
        states = torch.stack([self._state_tensor(row[0]) for row in batch])
        actions = torch.tensor([row[1] for row in batch], dtype=torch.int64)
        rewards = torch.tensor([row[2] for row in batch], dtype=torch.float32)
        next_states = torch.stack([self._state_tensor(row[3]) for row in batch])

        q_values = self.model(states).gather(1, actions.unsqueeze(1)).squeeze(1)
        with torch.no_grad():
            next_q = self.target_model(next_states).max(dim=1).values
            target = rewards + self.gamma * next_q
        loss = self.loss_fn(q_values, target)
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()
        return float(loss.item())

    def evaluate_actions(
        self,
        state: RetailState,
        product_profile: dict[str, float] | None = None,
    ) -> list[dict[str, Any]]:
        torch = self.torch
        with torch.no_grad():
            q_values = self.model(self._state_tensor(state)).detach().numpy()
        rows = []
        for idx, action in enumerate(self.actions):
            reward = reward_for(state, action, product_profile)
            rows.append(
                {
                    "action": action.label,
                    "quantity": action.order_quantity,
                    "shelf_delta": action.shelf_delta,
                    "value": round(float(q_values[idx]), 4),
                    "reward_components": asdict(reward),
                }
            )
        best = max(rows, key=lambda row: row["value"])
        for row in rows:
            row["isOptimal"] = row is best
        return sorted(rows, key=lambda row: row["value"], reverse=True)

    def get_action(
        self,
        state: RetailState,
        product_profile: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        return self.evaluate_actions(state, product_profile)[0]


def environment_config() -> dict[str, Any]:
    return {
        "state": {
            "inventory_bucket": list(INVENTORY_BUCKETS),
            "demand_regime": list(DEMAND_REGIMES),
            "lead_time_days": list(LEAD_TIME_BUCKETS),
            "shelf_bucket": list(SHELF_BUCKETS),
            "competitor_pressure": list(COMPETITION_BUCKETS),
        },
        "actions": [{"order_quantity": qty, "shelf_delta": delta} for qty in ORDER_QUANTITIES for delta in SHELF_DELTAS],
        "reward": [
            "revenue_reward",
            "ordering_penalty",
            "holding_penalty",
            "stockout_penalty",
            "wastage_penalty",
            "shelf_penalty",
        ],
    }


def build_state(
    current_stock: int,
    demand_regime: str,
    lead_time_days: int,
    shelf_stock: int,
    shelf_capacity: int,
    competitor_pressure: str,
    storage_capacity: int,
) -> RetailState:
    return RetailState(
        bucket_inventory(current_stock, storage_capacity),
        demand_regime if demand_regime in DEMAND_REGIMES else "NORMAL",
        max(1, min(4, int(lead_time_days))),
        bucket_shelf(shelf_stock / max(1, shelf_capacity)),
        competitor_pressure if competitor_pressure in COMPETITION_BUCKETS else "NORMAL",
    )


def engine_for(algorithm: str) -> DecisionEngine:
    normalized = algorithm.upper().replace("-", "_")
    if normalized in {"Q_LEARNING", "QLEARNING"}:
        return QLearningEngine()
    if normalized in {"DQN", "DEEP_Q_NETWORK"}:
        return DQNEngine()
    return ValueIterationEngine()


def estimate_stockout_risk(current_stock: int, expected_demand: float, lead_time_days: int) -> float:
    exposure = expected_demand * max(1, lead_time_days)
    if exposure <= 0:
        return 0.0
    risk = max(0.0, min(0.95, (exposure - current_stock) / exposure))
    return round(risk, 4)
