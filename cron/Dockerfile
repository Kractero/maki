FROM python:3-slim

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir -r requirements.txt

RUN apt-get update && apt-get install -y cron

RUN echo "*/5 * * * * cd /app && /usr/local/bin/python3 /app/main.py >> /app/app.log 2>&1" > /etc/cron.d/your_cron_job

RUN chmod 0644 /etc/cron.d/your_cron_job

RUN crontab /etc/cron.d/your_cron_job

RUN touch /var/log/cron.log

CMD ["cron", "-f"]
