"""Conservative section detection and whole-statement chunking.

Token units are ceil(Unicode character count / 4), an explicit approximation,
not billing tokens. Oversize indivisible requirements fail instead of truncating.
"""
import hashlib
import math
import re

SECTION_PATTERNS = [
    ('security', r'\b(security|keamanan)\b'),
    ('use_cases', r'\b(use cases?|supporting artifacts|kasus penggunaan)\b'),
    ('overall_description', r'\b(overall description|product perspective|deskripsi umum)\b'),
    ('specific_requirements', r'\b(specific requirements|functional requirements|non.functional requirements|design constraints|performance requirements|kebutuhan khusus)\b'),
    ('introduction', r'\b(introduction|purpose|scope|pendahuluan)\b'),
]


def token_count(text):
    return max(1, math.ceil(len(text) / 4))


def detect_section(line):
    line = line.strip()
    if len(line) > 120 or not re.match(r'^(?:#{1,6}\s|\d+(?:\.\d+)*[.\s]|[A-Z][A-Z\s]+$)', line):
        return None
    for section, pattern in SECTION_PATTERNS:
        if re.search(pattern, line, re.I):
            return section, 0.9
    return 'unknown', 0.0


def sections(document):
    current = document.get('ieee_section', 'unknown')
    confidence = 1.0 if current != 'unknown' else 0.0
    lines = []
    for line in document['content'].splitlines():
        detected = detect_section(line)
        if detected:
            if lines:
                yield current, confidence, '\n'.join(lines)
            current, confidence = detected
            lines = []
        elif line.strip():
            lines.append(line.strip())
    if lines:
        yield current, confidence, '\n'.join(lines)


def statements(text):
    # Preserve numbered requirements and wrapped continuation lines atomically.
    result = []
    for paragraph in re.split(r'\n\s*\n', text):
        lines = paragraph.splitlines()
        if any(re.match(r'^(?:REQ[-_]|[A-Z]{1,8}[-_]\d|\d+[.)]\s)', line) for line in lines):
            for line in lines:
                if result and not re.match(r'^(?:REQ[-_]|[A-Z]{1,8}[-_]\d|\d+[.)]\s)', line):
                    result[-1] += ' ' + line
                else:
                    result.append(line)
        else:
            result.extend(re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', ' '.join(lines)))
    return [s.strip() for s in result if s.strip()]


def chunk_document(document):
    result = []
    for section, confidence, text in sections(document):
        units = statements(text)
        if any(token_count(u) > 600 for u in units):
            raise ValueError(f'oversize_requirement:{document["doc_id"]}; manually review without truncating')
        start = 0
        while start < len(units):
            end = start
            while end < len(units) and token_count('\n'.join(units[start:end + 1])) <= 600:
                end += 1
                if token_count('\n'.join(units[start:end])) >= 450:
                    break
            content = '\n'.join(units[start:end])
            metadata = {**document.get('metadata', {}), 'language': document['language'],
                        'section_confidence': confidence, 'tokenizer': 'characters/4-v1',
                        'tail': end == len(units), 'chunk_type': document.get('chunk_type', 'document_section')}
            result.append(dict(doc_id=document['doc_id'], dataset_source=document['dataset_source'],
                               domain=document.get('domain'), ieee_section=section, content=content,
                               chunk_index=len(result), token_count=token_count(content), metadata=metadata,
                               content_hash=hashlib.sha256(content.encode()).hexdigest()))
            if end == len(units):
                break
            # Whole-statement overlap closest to 12.5%, bounded at 15%.
            overlap = end
            while overlap > start + 1 and token_count('\n'.join(units[overlap - 1:end])) <= token_count(content) * .15:
                overlap -= 1
            metadata['overlap_tokens'] = token_count('\n'.join(units[overlap:end])) if overlap < end else 0
            start = overlap
    return result


def assign_split(documents, seed):
    groups = {}
    for doc in documents:
        groups.setdefault(doc['dataset_source'], set()).add(doc['doc_id'])
    manifest = {}
    for source, ids in groups.items():
        ordered = sorted(ids, key=lambda doc_id: hashlib.sha256(f'{seed}:{doc_id}'.encode()).hexdigest())
        held_out = set(ordered[:max(1, round(len(ordered) * .2))]) if len(ordered) > 1 and source != 'dev_seed' else set()
        manifest.update({doc_id: 'ground_truth' if doc_id in held_out else 'kb' for doc_id in ordered})
    return manifest
