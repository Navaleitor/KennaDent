# Imagen del backend de KennaDent (Django + Gunicorn). La misma imagen sirve
# para el entorno local, QA y la nube; lo que cambia son las variables de entorno.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN KD_DEBUG=1 python manage.py collectstatic --noinput -v0 \
 && useradd --create-home --uid 10001 kennadent \
 && chmod +x entrypoint.sh
USER kennadent

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
