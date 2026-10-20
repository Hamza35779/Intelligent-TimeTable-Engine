"""
Asynchronous Job Queue and Task Manager for Timetable Generation.

Decouples long-running CP-SAT solver calls from FastAPI request threads.
Prevents HTTP connection timeouts and worker thread starvation under concurrent load.
"""

from __future__ import annotations

import concurrent.futures
import datetime
import threading
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, Optional


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class JobRecord:
    job_id: str
    status: JobStatus
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: int = 0  # 0 to 100
    message: str = "Job queued"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "progress": self.progress,
            "message": self.message,
            "result": self.result,
            "error": self.error,
            "metadata": self.metadata,
        }


class TimetableJobQueue:
    _instance: Optional[TimetableJobQueue] = None
    _lock = threading.Lock()

    def __new__(cls, max_workers: int = 4) -> TimetableJobQueue:
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_queue(max_workers)
            return cls._instance

    def _init_queue(self, max_workers: int):
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="TimetableSolverWorker",
        )
        self._jobs: Dict[str, JobRecord] = {}
        self._job_lock = threading.Lock()

    def submit_job(
        self,
        task_func: Callable[..., Dict[str, Any]],
        *args: Any,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> str:
        job_id = str(uuid.uuid4())
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
        record = JobRecord(
            job_id=job_id,
            status=JobStatus.QUEUED,
            created_at=now_str,
            metadata=metadata or {},
        )
        with self._job_lock:
            self._jobs[job_id] = record

        self._executor.submit(self._run_job_wrapper, job_id, task_func, *args, **kwargs)
        return job_id

    def _run_job_wrapper(
        self,
        job_id: str,
        task_func: Callable[..., Dict[str, Any]],
        *args: Any,
        **kwargs: Any,
    ):
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with self._job_lock:
            if job_id not in self._jobs:
                return
            self._jobs[job_id].status = JobStatus.RUNNING
            self._jobs[job_id].started_at = now_str
            self._jobs[job_id].progress = 10
            self._jobs[job_id].message = "Solver initializing"

        def progress_callback(pct: int, msg: str):
            with self._job_lock:
                if job_id in self._jobs:
                    self._jobs[job_id].progress = max(0, min(100, pct))
                    self._jobs[job_id].message = msg

        try:
            # Inject progress callback if supported
            if "progress_callback" in kwargs or task_func.__code__.co_varnames and "progress_callback" in task_func.__code__.co_varnames:
                kwargs["progress_callback"] = progress_callback
            
            result = task_func(*args, **kwargs)
            completed_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            with self._job_lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.COMPLETED
                    self._jobs[job_id].completed_at = completed_str
                    self._jobs[job_id].progress = 100
                    self._jobs[job_id].message = "Timetable successfully generated"
                    self._jobs[job_id].result = result
        except Exception as exc:
            completed_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            with self._job_lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.FAILED
                    self._jobs[job_id].completed_at = completed_str
                    self._jobs[job_id].progress = 100
                    self._jobs[job_id].message = f"Execution failed: {str(exc)}"
                    self._jobs[job_id].error = str(exc)

    def get_job(self, job_id: str) -> Optional[JobRecord]:
        with self._job_lock:
            return self._jobs.get(job_id)

    def list_recent_jobs(self, limit: int = 50) -> Dict[str, Any]:
        with self._job_lock:
            sorted_jobs = sorted(
                self._jobs.values(),
                key=lambda j: j.created_at,
                reverse=True,
            )[:limit]
            return [j.to_dict() for j in sorted_jobs]


# Global singleton queue instance
job_queue = TimetableJobQueue()
