import logging
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from backend.db.models import Decision, Conflict
from backend.models.action import ActionType, RiskLevel

logger = logging.getLogger(__name__)

ALLOWED_ACTION_TYPES = [ActionType.CREATE_TASK.value, ActionType.SAVE_BRIEF.value]

class ActionPolicyService:
    @staticmethod
    def check_preconditions(db: Session, decision: Decision):
        """
        Validates if we are even allowed to propose an action for this decision.
        """
        open_conflicts = db.query(Conflict).filter(
            Conflict.normalized_topic == decision.normalized_topic,
            Conflict.status == "open"
        ).count()

        if open_conflicts > 0:
            raise ValueError(f"Cannot propose action: there is an open conflict for topic '{decision.topic}'.")

    @staticmethod
    def validate_proposal(
        db: Session,
        action_type: str,
        payload: Dict[str, Any],
        risk_level: str,
        decision: Decision
    ) -> bool:
        """
        Validates if an action is allowed by policy.
        Raises ValueError if invalid, otherwise returns True.
        """
        if action_type not in ALLOWED_ACTION_TYPES:
            raise ValueError(f"Action type '{action_type}' is not permitted.")

        # Preconditions check
        ActionPolicyService.check_preconditions(db, decision)

        # Risk level validation
        allowed_risks = [RiskLevel.LOW.value, RiskLevel.MEDIUM.value, RiskLevel.HIGH.value]
        if risk_level not in allowed_risks:
            raise ValueError(f"Invalid risk level '{risk_level}'.")

        # Payload validation
        if action_type == ActionType.CREATE_TASK.value:
            if "task_title" not in payload:
                raise ValueError("Payload missing 'task_title' for create_task.")
            if "notes" not in payload:
                raise ValueError("Payload missing 'notes' for create_task.")
        elif action_type == ActionType.SAVE_BRIEF.value:
            if "title" not in payload:
                raise ValueError("Payload missing 'title' for save_brief.")
            if "content" not in payload:
                raise ValueError("Payload missing 'content' for save_brief.")

        return True
