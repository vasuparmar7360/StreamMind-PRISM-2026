"""
StreamMind Retrieval Controller
================================
Decides whether accumulated transcript text warrants a corpus search.

Decision states:
  WAIT        — text too short / not yet meaningful
  RETRIEVE    — enough stable intent detected, start a search now
  NO_RETRIEVAL — conversational / acknowledgement, skip retrieval

Design approach (lightweight, no LLM inference per chunk):
  1. Minimum meaningful-word threshold (filters pure punctuation/stop-words).
  2. Hash-based change detection — skip if text hasn't changed enough since
     the last retrieval query.
  3. Simple intent heuristics: question words, named entities (capitalized
     tokens), domain verbs ("explain", "compare", "list", "what", "how", etc).
  4. Conversational exclusion: short affirmatives/negatives, greetings.

Limitations (documented as required):
  - No LLM-quality intent parsing; relies on surface heuristics.
  - No dependency parsing; does not detect negation of intent.
  - Named-entity detection is capitalization-based — misses lower-case proper
    nouns and is tripped by sentence-starting capitals.
  - Similarity threshold for "changed enough" is based on Jaccard overlap
    of content words, not semantic distance.
  - Does not distinguish between question + answer in the transcript.
"""

import re
import math
from typing import Tuple


# Words that count as meaningful intent signals
QUESTION_WORDS = {
    "what", "who", "where", "when", "why", "how", "which", "whose", "whom",
    "explain", "describe", "compare", "list", "summarize", "find", "show",
    "tell", "define", "identify", "analyse", "analyze",
}

# Common English stop words that don't carry domain intent
STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to",
    "for", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should", "may",
    "might", "shall", "can", "need", "dare", "ought", "used", "i", "you",
    "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
    "my", "your", "his", "its", "our", "their", "this", "that", "these",
    "those", "there", "here", "so", "just", "also", "then", "than", "with",
    "from", "by", "about", "up", "out", "if", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "each",
    "few", "more", "most", "other", "some", "such", "no", "not", "only",
    "own", "same", "too", "very", "s", "t", "ll", "ve", "d", "re",
}

# Short conversational phrases that never need retrieval
CONVERSATIONAL_PATTERNS = re.compile(
    r"^(yes|no|ok|okay|sure|alright|thanks|thank you|hello|hi|bye|goodbye"
    r"|got it|understood|makes sense|i see|right|great|good|cool|nice"
    r"|hmm|hm|uh|um|ah|oh|really|interesting)\W*$",
    re.IGNORECASE,
)

MIN_MEANINGFUL_WORDS = 5        # below this, always WAIT
MIN_RETRIEVE_WORDS = 8          # above this, consider RETRIEVE
JACCARD_CHANGE_THRESHOLD = 0.25 # must differ by at least this from last query


def _tokenize(text: str) -> list[str]:
    """Return lowercase alpha tokens."""
    return re.findall(r"[a-zA-Z']+", text.lower())


def _content_words(tokens: list[str]) -> set[str]:
    """Remove stop words; keep words ≥ 3 chars."""
    return {t for t in tokens if t not in STOP_WORDS and len(t) >= 3}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    union = a | b
    return len(a & b) / len(union)


def _has_question_intent(tokens: list[str], text: str) -> bool:
    """Returns True if the text looks like it is asking for information."""
    # Direct question words
    if any(t in QUESTION_WORDS for t in tokens):
        return True
    # Ends with '?'
    if text.rstrip().endswith("?"):
        return True
    # Has capitalized tokens (probable named entities) beyond the first word
    words = text.split()
    named_entities = [w for w in words[1:] if w and w[0].isupper() and not w.isupper()]
    if len(named_entities) >= 1:
        return True
    return False


def decide(
    accumulated_text: str,
    last_retrieval_query: str,
) -> Tuple[str, str]:
    """
    Returns (decision, reason) where decision ∈ {"WAIT", "RETRIEVE", "NO_RETRIEVAL"}.

    Parameters
    ----------
    accumulated_text     : full transcript so far
    last_retrieval_query : the query string used in the most recent retrieval
    """
    text = accumulated_text.strip()

    # Conversational exclusion (always NO_RETRIEVAL regardless of length)
    if CONVERSATIONAL_PATTERNS.match(text):
        return "NO_RETRIEVAL", "conversational acknowledgement"

    tokens = _tokenize(text)
    meaningful = _content_words(tokens)
    word_count = len(tokens)

    if word_count < MIN_MEANINGFUL_WORDS:
        return "WAIT", f"only {word_count} words — below minimum ({MIN_MEANINGFUL_WORDS})"

    if word_count < MIN_RETRIEVE_WORDS and not _has_question_intent(tokens, text):
        return "WAIT", f"{word_count} words, no clear question intent yet"

    # Check how much has changed since the last retrieval
    last_tokens = _tokenize(last_retrieval_query) if last_retrieval_query else []
    last_content = _content_words(last_tokens)
    similarity = _jaccard(meaningful, last_content)
    change = 1.0 - similarity

    if change < JACCARD_CHANGE_THRESHOLD and last_retrieval_query:
        return "WAIT", (
            f"content-word change {change:.2f} below threshold {JACCARD_CHANGE_THRESHOLD} "
            f"— not meaningfully different from last query"
        )

    if not _has_question_intent(tokens, text) and word_count < 15:
        return "WAIT", "no clear question intent and text still short"

    return "RETRIEVE", (
        f"{word_count} words, change={change:.2f}, intent detected"
    )
