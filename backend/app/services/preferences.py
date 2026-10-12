from sqlalchemy.orm import Session

from app.models import Store, SystemSetting


def store_preferences(db: Session, store: Store) -> dict:
    stored = db.get(SystemSetting, f"store:{store.id}")
    return {"autonomyMode": "HUMAN_APPROVAL", "maxAutoQuantity": 24, "maxAutoSpend": 500,
            "serviceLevelTarget": 98, "enableSound": True, "mascotReactivity": "balanced",
            **(stored.value if stored else {}), "storeName": store.name, "storeId": store.id, "managerName": store.manager_name}
