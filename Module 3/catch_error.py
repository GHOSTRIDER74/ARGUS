import sys
import traceback

try:
    import pipeline
    pipeline.run()
except Exception as e:
    with open("error_log.txt", "w") as f:
        traceback.print_exc(file=f)
