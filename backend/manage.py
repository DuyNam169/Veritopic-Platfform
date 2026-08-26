#!/usr/bin/env python
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Không thể import Django. Đảm bảo đã cài đặt và kích hoạt đúng virtualenv."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
