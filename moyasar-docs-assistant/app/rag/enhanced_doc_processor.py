import re
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any
from pathlib import Path

# Attempt to import existing utilities, define fallbacks if not found
try:
    from app.utils.text_utils import strip_mdx, count_tokens
except ImportError:
    print("Warning: app.utils.text_utils not found, using fallback implementations.")
    def strip_mdx(text: str) -> str:
        # Basic MDX stripping for JSX components
        # This is a simplified version and might need enhancement
        import re
        # Remove import statements
        text = re.sub(r'^\s*import\s+.*?from\s+[\'\"].*?[\'\"]\s*;?$', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*import\s+.*?;?$', '', text, flags=re.MULTILINE)
        # Remove JSX-like tags (very basic)
        text = re.sub(r'<\s*Tabs\b[^>]*>.*?<\s*\/\s*Tabs\s*>', '', text, flags=re.DOTALL)
        text = re.sub(r'<\s*TabItem\b[^>]*>.*?<\s*\/\s*TabItem\s*>', '', text, flags=re.DOTALL)
        # Remove other custom components if known patterns exist
        return text.strip()

    def count_tokens(text: str) -> int:
        # A very basic token counter (split by whitespace)
        # For better accuracy, consider a library like tiktoken
        return len(text.split())

@dataclass
class ProcessedChunk:
    id: str
    title: str
    content: str
    feature: str
    platform: str
    type: str
    keywords: str # Changed from List[str] to str
    # file_path and filename can be part of metadata or handled by the caller
    file_path: str = ""
    filename: str = ""

def _split_by_headings_improved(text: str) -> List[Dict[str, Any]]:
    """
    Split markdown text into sections, trying to identify H1, H2, H3.
    Returns a list of dicts with 'level', 'title', and 'content'.
    """
    sections = []
    current_section = {"level": 0, "title": "", "content": ""}
    lines = text.split('\n')

    for line in lines:
        match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if match:
            # Save the previous section if it has content
            if current_section["content"].strip():
                sections.append(current_section.copy())
            
            level = len(match.group(1))
            title = match.group(2).strip()
            current_section = {"level": level, "title": title, "content": line + "\n"}
        else:
            current_section["content"] += line + "\n"
    
    # Add the last section
    if current_section["content"].strip():
        sections.append(current_section.copy())
        
    return sections

def _rewrite_headings_to_meaningful(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Rewrites generic headings to be more descriptive based on context.
    This is a simplified version; a more advanced version might use NLP or heuristics.
    """
    rewritten_sections = []
    for i, sec in enumerate(sections):
        new_title = sec["title"]
        if sec["level"] == 1 and not new_title: # H1 with no title (e.g. first line)
             if i + 1 < len(sections) and sections[i+1]["level"] == 2:
                 new_title = f"Overview of {sections[i+1]['title']}"
             else:
                 new_title = "General Information"
        elif "step" in new_title.lower() and str(i+1) in new_title.lower():
            # Example: "Step 1" -> "Step 1: [Actionable Description]"
            # This requires more context to be truly effective.
            # For now, we'll just ensure it's not just "Step X"
            if i > 0 and sections[i-1]["title"]: # Use previous section title for context
                context_title = sections[i-1]["title"]
                new_title = f"Step {i+1}: {context_title} - {new_title.replace(f'Step {i+1}', '').strip()}"
        
        # Ensure title is not empty
        if not new_title and sec["content"].strip():
            # Fallback: take the first non-empty line of content as title
            first_line = sec["content"].split('\n')[0].strip()
            if first_line and not first_line.startswith('#'):
                new_title = first_line
            else:
                new_title = f"Section {sec['level']}"
        
        sec["title"] = new_title
        rewritten_sections.append(sec)
    return rewritten_sections

def _chunk_content_by_rules(sections: List[Dict[str, Any]], min_words: int = 150, max_words: int = 400) -> List[Dict[str, Any]]:
    """
    Chunks content based on word count and tries to respect section boundaries.
    Each chunk will have a title derived from its main section.
    """
    final_chunks = []
    current_chunk_content = []
    current_chunk_title = ""
    current_chunk_word_count = 0

    for sec in sections:
        sec_lines = sec["content"].split('\n')
        sec_title = sec["title"]
        sec_level = sec["level"]
        
        # Start a new chunk if this is a top-level section (H1 or H2)
        if sec_level <= 2 and current_chunk_content:
            if current_chunk_word_count >= min_words:
                final_chunks.append({
                    "title": current_chunk_title,
                    "content": "\n".join(current_chunk_content).strip()
                })
            current_chunk_content = [sec["content"]] # Start with the full section
            current_chunk_title = sec_title
            current_chunk_word_count = count_tokens(sec["content"])
        else:
            # Add to current chunk if it doesn't exceed max_words
            # Simple word count for the section part
            sec_word_count = count_tokens("\n".join(sec_lines))
            if current_chunk_word_count + sec_word_count <= max_words:
                current_chunk_content.extend(sec_lines)
                current_chunk_word_count += sec_word_count
                # Update title if this section is more prominent (lower level)
                if sec_level < 3: # H1 or H2
                    current_chunk_title = sec_title
            else:
                # Finalize current chunk if it has content
                if current_chunk_content and current_chunk_word_count >= min_words:
                    final_chunks.append({
                        "title": current_chunk_title,
                        "content": "\n".join(current_chunk_content).strip()
                    })
                # Start new chunk with current section
                current_chunk_content = sec_lines
                current_chunk_title = sec_title
                current_chunk_word_count = sec_word_count

    # Add the last chunk
    if current_chunk_content and current_chunk_word_count >= min_words:
        final_chunks.append({
            "title": current_chunk_title,
            "content": "\n".join(current_chunk_content).strip()
        })
    
    # Handle cases where a section is too small and might be left out
    if not final_chunks and sections:
        # Fallback: create one chunk from the first meaningful section
        for sec in sections:
            if count_tokens(sec["content"]) >= min_words:
                final_chunks.append({
                    "title": sec["title"],
                    "content": sec["content"].strip()
                })
                break
        if not final_chunks: # If still nothing, combine all
            combined_content = "\n".join([s["content"] for s in sections])
            final_chunks.append({
                "title": "Full Document Content",
                "content": combined_content.strip()
            })

    return final_chunks

def _generate_metadata_for_chunk(chunk_content: str, chunk_title: str, file_path: str, filename: str, section_type_hint: str = "") -> Dict[str, Any]:
    """
    Generates metadata for a chunk.
    """
    # Basic keyword extraction (can be improved with NLP libraries)
    keywords = re.findall(r'\b[A-Z][a-zA-Z0-9]{2,}\b', chunk_content) + re.findall(r'\b[a-z]{6,}\b', chunk_content)
    keywords = list(set([k.lower() for k in keywords if len(k) > 3])) # Deduplicate and filter short words
    keywords_str = ", ".join(keywords) # Convert list to comma-separated string

    # Determine feature and platform from filename or content
    feature = "general"
    platform = "general"
    if "apple" in filename.lower() or "apple" in chunk_title.lower():
        feature = "apple_pay"
    elif "stc" in filename.lower() or "stc" in chunk_title.lower():
        feature = "stc_pay"
    elif "credit" in filename.lower() or "credit" in chunk_title.lower():
        feature = "credit_card"
    
    if "ios" in filename.lower() or "swiftui" in chunk_content.lower() or "uikit" in chunk_content.lower():
        platform = "ios"
    elif "android" in filename.lower(): # Assuming android docs might exist
        platform = "android"
    
    # Determine chunk type
    chunk_type = section_type_hint.lower() if section_type_hint else "general"
    if any(word in chunk_title.lower() or chunk_content.lower() for word in ["prerequisite", "setup", "configure", "install"]):
        chunk_type = "setup"
    elif any(word in chunk_title.lower() or chunk_content.lower() for word in ["error", "fail", "exception", "troubleshoot"]):
        chunk_type = "error"
    elif any(word in chunk_title.lower() or chunk_content.lower() for word in ["step", "how to", "guide", "process"]):
        chunk_type = "flow"
    elif any(word in chunk_title.lower() or chunk_content.lower() for word in ["example", "sample", "demo"]):
        chunk_type = "example"
    elif any(word in chunk_title.lower() or chunk_content.lower() for word in ["constraint", "limit", "requirement"]):
        chunk_type = "constraint"
    elif any(word in chunk_title.lower() or chunk_content.lower() for word in ["note", "important", "warning", "caution"]):
        chunk_type = "note" # Or 'general' if not a primary section type
    else: # Default if no clear type
        chunk_type = "general"


    return {
        "id": f"{Path(filename).stem}_{hash(chunk_title + chunk_content) % 10000}", # Simple unique ID
        "title": chunk_title,
        "content": chunk_content,
        "feature": feature,
        "platform": platform,
        "type": chunk_type,
        "keywords": keywords_str, # Use the string version
        "file_path": file_path,
        "filename": filename,
    }

def _generate_questions_for_chunk(chunk_metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generates realistic developer questions for a given chunk.
    """
    questions = []
    title = chunk_metadata["title"]
    content = chunk_metadata["content"]
    feature = chunk_metadata["feature"]
    platform = chunk_metadata["platform"]
    chunk_type = chunk_metadata["type"]
    keywords_str = chunk_metadata["keywords"] # This is now a string

    # How-to questions
    if chunk_type in ["setup", "flow", "configuration"]:
        questions.append({
            "question": f"How do I {title.lower()} for {feature} on {platform}?",
            "related_chunks": [chunk_metadata["id"]]
        })
        questions.append({
            "question": f"Steps to configure {feature} in {platform} application.",
            "related_chunks": [chunk_metadata["id"]]
        })

    # Error/Why questions
    if chunk_type == "error":
        # Extract first keyword from string if possible
        first_keyword = keywords_str.split(",")[0] if keywords_str else "error"
        questions.append({
            "question": f"Why is my {feature} integration failing on {platform}?",
            "related_chunks": [chunk_metadata["id"]]
        })
        questions.append({
            "question": f"Fix {first_keyword} when implementing {feature} for {platform}.",
            "related_chunks": [chunk_metadata["id"]]
        })
    
    # Specific concept questions
    if keywords_str:
        first_keyword = keywords_str.split(",")[0]
        questions.append({
            "question": f"What is {first_keyword} in the context of {feature} for {platform}?",
            "related_chunks": [chunk_metadata["id"]]
        })
    
    # General questions based on title
    questions.append({
        "question": f"{title} for {feature} on {platform}",
        "related_chunks": [chunk_metadata["id"]]
    })
    
    return questions

def process_document_markdown(mdx_content: str, file_path: str) -> Dict[str, Any]:
    """
    Main processing function for a single markdown/MDX document.
    Follows the 5-phase approach.
    """
    filename = Path(file_path).name

    # Phase 1: Cleaning & Normalization
    cleaned_markdown = strip_mdx(mdx_content)

    # Phase 2: Structure Improvement
    # Split into sections and rewrite headings
    sections = _split_by_headings_improved(cleaned_markdown)
    sections = _rewrite_headings_to_meaningful(sections)
    
    # The "clean_markdown" for output will be the one with rewritten headings
    final_clean_markdown = "\n".join([f"{'#' * sec['level']} {sec['title']}\n{sec['content'].strip()}" for sec in sections])


    # Phase 3: Semantic Chunking
    raw_chunks_content = _chunk_content_by_rules(sections) # These are dicts with title and content

    # Phase 4: Metadata Enrichment
    processed_chunks_list = []
    for chunk_data in raw_chunks_content:
        # Determine a hint for chunk type based on title
        type_hint = ""
        if any(word in chunk_data["title"].lower() for word in ["prerequisite", "setup", "configure", "install"]):
            type_hint = "setup"
        elif any(word in chunk_data["title"].lower() for word in ["error", "fail", "exception", "troubleshoot"]):
            type_hint = "error"
        # Add more hints as needed
        
        metadata = _generate_metadata_for_chunk(
            chunk_content=chunk_data["content"],
            chunk_title=chunk_data["title"],
            file_path=file_path,
            filename=filename,
            section_type_hint=type_hint
        )
        processed_chunks_list.append(metadata)

    # Phase 5: Question Generation
    generated_questions = []
    for chunk_meta in processed_chunks_list:
        generated_questions.extend(_generate_questions_for_chunk(chunk_meta))

    # Compile final output
    output = {
        "clean_markdown": final_clean_markdown,
        "chunks": processed_chunks_list,
        "questions": generated_questions
    }
    return output

if __name__ == '__main__':
    # Example usage:
    # Create a dummy MDX file for testing
    dummy_mdx_content = """
---
title: Test Apple Pay
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Apple Pay Test

## Prerequisites

- Moyasar account
- Apple Developer Account

## Step 1: Configure Apple Pay

This is about setting up Apple Pay.
Details for step 1.

### Sub Step 1.1

More details here.

## Step 2: Implement Payment

This step covers implementation.
Code for payment.
    """
    dummy_file_path = "test_apple_pay.mdx"
    
    # For this example, we'll simulate reading from a string
    # In a real scenario, you'd read from a file: Path(file_path).read_text()
    processed_data = process_document_markdown(dummy_mdx_content, dummy_file_path)
    
    print(json.dumps(processed_data, indent=2, ensure_ascii=False))