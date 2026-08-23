#!/usr/bin/env python3
"""Compatibility entry point for the schema-aware public sanitizer.

Do not add broad string replacements here. Stable enums, URLs, IDs and HTML
attributes must remain machine-readable; only presentation/prose fields are localized.
"""
from safe_public_sanitize import main

if __name__ == "__main__":
    main()
