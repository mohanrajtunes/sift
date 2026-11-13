# Render runs `gunicorn config.wsgi` from this folder and picks this file up automatically.
# Threads let one worker keep a live answer streaming while it serves other requests.
worker_class = 'gthread'
workers = 2
threads = 8
timeout = 120
