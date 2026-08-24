from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.client import Config

from .config import settings


class StorageBackend:
    def put_file(self, local_path: Path, key: str, content_type: str) -> None:
        raise NotImplementedError

    def put_stream(self, stream: BinaryIO, key: str, content_type: str) -> None:
        raise NotImplementedError

    def local_path(self, key: str) -> Path | None:
        return None

    def download_file(self, key: str, target: Path) -> None:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def download_url(self, key: str, expires_seconds: int = 300) -> str | None:
        return None


class LocalStorage(StorageBackend):
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _target(self, key: str) -> Path:
        target = (self.root / key).resolve()
        if self.root not in target.parents and target != self.root:
            raise ValueError('Invalid object key')
        return target

    def put_file(self, local_path: Path, key: str, content_type: str) -> None:
        target = self._target(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(local_path, target)

    def put_stream(self, stream: BinaryIO, key: str, content_type: str) -> None:
        target = self._target(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('wb') as output:
            shutil.copyfileobj(stream, output)

    def local_path(self, key: str) -> Path | None:
        path = self._target(key)
        return path if path.exists() else None

    def download_file(self, key: str, target: Path) -> None:
        source = self._target(key)
        if not source.exists():
            raise FileNotFoundError(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    def delete(self, key: str) -> None:
        path = self._target(key)
        if path.exists():
            path.unlink()


class MinioStorage(StorageBackend):
    def __init__(self) -> None:
        self.client = boto3.client(
            's3',
            endpoint_url=settings.object_storage_endpoint,
            aws_access_key_id=settings.object_storage_access_key,
            aws_secret_access_key=settings.object_storage_secret_key,
            region_name=settings.object_storage_region,
            config=Config(signature_version='s3v4'),
        )
        self.public_client = boto3.client(
            's3',
            endpoint_url=settings.object_storage_public_endpoint or settings.object_storage_endpoint,
            aws_access_key_id=settings.object_storage_access_key,
            aws_secret_access_key=settings.object_storage_secret_key,
            region_name=settings.object_storage_region,
            config=Config(signature_version='s3v4'),
        )
        self.bucket = settings.object_storage_bucket
        existing = [bucket['Name'] for bucket in self.client.list_buckets().get('Buckets', [])]
        if self.bucket not in existing:
            self.client.create_bucket(Bucket=self.bucket)

    def put_file(self, local_path: Path, key: str, content_type: str) -> None:
        self.client.upload_file(
            str(local_path),
            self.bucket,
            key,
            ExtraArgs={'ContentType': content_type},
        )

    def put_stream(self, stream: BinaryIO, key: str, content_type: str) -> None:
        self.client.upload_fileobj(
            stream,
            self.bucket,
            key,
            ExtraArgs={'ContentType': content_type},
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def download_file(self, key: str, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        self.client.download_file(self.bucket, key, str(target))

    def download_url(self, key: str, expires_seconds: int = 300) -> str | None:
        return self.public_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=expires_seconds,
        )


def get_storage() -> StorageBackend:
    if settings.object_storage_mode.lower() == 'minio':
        return MinioStorage()
    return LocalStorage(settings.object_root_path)
