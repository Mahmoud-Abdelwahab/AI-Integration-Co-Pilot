import re


# Platforms detected from file path keywords
PLATFORM_KEYWORDS = {
    "ios": ["ios", "swift", "apple"],
    "flutter": ["flutter", "dart"],
    "android": ["android", "kotlin"],
    "web": ["web", "javascript", "react", "js"],
    "api": ["api", "rest", "http"],
}


def detect_platform(file_path: str) -> str:
    path_lower = file_path.lower()
    for platform, keywords in PLATFORM_KEYWORDS.items():
        if any(k in path_lower for k in keywords):
            return platform
    return "general"


def strip_mdx(text: str) -> str:
    """Remove MDX/JSX-specific syntax while preserving markdown content."""
    # Remove import/export statements
    text = re.sub(r'^(import|export)\s+.*$', '', text, flags=re.MULTILINE)
    # Remove JSX component tags (self-closing and paired)
    text = re.sub(r'<[A-Z][A-Za-z0-9]*[^>]*/>', '', text)  # self-closing
    text = re.sub(r'<[A-Z][A-Za-z0-9]*[^>]*>.*?</[A-Z][A-Za-z0-9]*>', '', text, flags=re.DOTALL)
    # Remove MDX expression blocks {/* ... */} and {variable}
    text = re.sub(r'\{/\*.*?\*/\}', '', text, flags=re.DOTALL)
    text = re.sub(r'\{[^}]+\}', '', text)
    # Remove frontmatter (YAML)
    text = re.sub(r'^---\n.*?\n---\n', '', text, flags=re.DOTALL)
    # Collapse excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def count_tokens(text: str) -> int:
    """Rough token estimation: ~4 chars per token."""
    return len(text) // 4


def extract_headings(text: str) -> list[str]:
    """Extract all markdown headings from text."""
    return re.findall(r'^#{1,6}\s+(.+)$', text, flags=re.MULTILINE)
