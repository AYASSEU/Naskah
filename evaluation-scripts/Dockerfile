FROM python:3.13-slim-bookworm@sha256:a5a7017efc5969e00ae2b91c8eb0631049a569652aa4ffc4501769049ae45c72
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 HOME=/tmp
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir bert-score==0.3.13 transformers==4.56.2
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('distilbert/distilbert-base-multilingual-cased',revision='45c032ab32cc946ad88a166f7cb282f58c753c2e',allow_patterns=['config.json','model.safetensors','tokenizer.json','tokenizer_config.json','vocab.txt'],local_dir='/opt/bert-model')"
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
COPY . .
ARG SOURCE_HASH
ENV EVALUATION_ID=$SOURCE_HASH
RUN useradd -u 10001 -m evaluator
USER evaluator
EXPOSE 8010
CMD ["python","server.py"]
