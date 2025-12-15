import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    desc,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base declarative class for ORM models."""


class User(Base):
    """
    Таблица для пользовательских настроек.
    Сейчас используется только tz_offset_min (смещение пояса в минутах от UTC).
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # telegram user_id
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    tz_offset_min: Mapped[int] = mapped_column(Integer, default=0)
    username: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)


class Tasting(Base):
    __tablename__ = "tastings"
    __table_args__ = (
        Index("ux_tastings_user_seq", "user_id", "seq_no", unique=True),
        Index("ix_tastings_user_category", "user_id", "category"),
        Index("ix_tastings_user_year", "user_id", "year"),
        Index("ix_tastings_user_rating", "user_id", "rating"),
        Index("ix_tastings_user_id_desc", "user_id", desc("id")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    # кто создал запись
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200))
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    category: Mapped[str] = mapped_column(String(60))
    entry_mode: Mapped[str] = mapped_column(
        String(16), default="full", server_default=sa.text("'full'"), nullable=False
    )

    grams: Mapped[Optional[float]] = mapped_column(nullable=True)
    temp_c: Mapped[Optional[int]] = mapped_column(nullable=True)
    tasted_at: Mapped[Optional[str]] = mapped_column(
        String(8), nullable=True
    )  # "HH:MM" локальное для юзера
    gear: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    aroma_dry: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aroma_warmed: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # объединённый «прогретый/промытый»
    aroma_after: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # оставлено для совместимости

    effects_csv: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # «Ощущения»
    scenarios_csv: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # «Сценарии»

    rating: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    seq_no: Mapped[int] = mapped_column(Integer, nullable=False)

    infusions: Mapped[List["Infusion"]] = relationship(
        back_populates="tasting", cascade="all, delete-orphan"
    )
    photos: Mapped[List["Photo"]] = relationship(cascade="all, delete-orphan")

    @property
    def title(self) -> str:
        parts: List[str] = [f"[{self.category}]", self.name]
        extra: List[str] = []
        if self.year:
            extra.append(str(self.year))
        if self.region:
            extra.append(self.region)
        if extra:
            parts.append("(" + ", ".join(extra) + ")")
        return " ".join(parts)


class Infusion(Base):
    __tablename__ = "infusions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tasting_id: Mapped[int] = mapped_column(
        ForeignKey("tastings.id", ondelete="CASCADE")
    )
    n: Mapped[int] = mapped_column(Integer)

    seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    liquor_color: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    taste: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    special_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aftertaste: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    tasting: Mapped["Tasting"] = relationship(back_populates="infusions")


class Photo(Base):
    __tablename__ = "photos"
    __table_args__ = (Index("ix_photos_object_key", "object_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tasting_id: Mapped[int] = mapped_column(
        ForeignKey("tastings.id", ondelete="CASCADE")
    )
    file_id: Mapped[str] = mapped_column(String(255))
    storage_backend: Mapped[str] = mapped_column(
        String(16), nullable=False, default="local", server_default="local"
    )
    object_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    telegram_file_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telegram_file_unique_id: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
