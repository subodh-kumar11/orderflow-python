import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.db import Database
from app.service import process_pending

logger = logging.getLogger(__name__)


def run_processing(db: Database) -> int:
    with db.sessions() as session:
        count = process_pending(session)
    logger.info("Moved %d pending orders to processing", count)
    return count


def make_scheduler(db: Database, interval: int) -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        run_processing,
        "interval",
        seconds=interval,
        args=[db],
        id="process-pending",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
        replace_existing=True,
    )
    return scheduler
