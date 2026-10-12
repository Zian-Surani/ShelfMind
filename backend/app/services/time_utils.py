from __future__ import annotations

from datetime import datetime, timezone


def as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def time_ago(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
    delta = now - as_utc(dt)
    seconds = max(0, int(delta.total_seconds()))
    if seconds < 60:
        return "Just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "1d ago"
    if days < 7:
        return f"{days}d ago"
    return dt.strftime("%d %b")

