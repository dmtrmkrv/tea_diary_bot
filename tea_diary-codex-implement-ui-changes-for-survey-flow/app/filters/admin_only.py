from aiogram import types
from aiogram.filters import BaseFilter


class AdminOnly(BaseFilter):
    def __init__(self, admins: set[int]):
        self.admins = admins

    async def __call__(self, message: types.Message) -> bool:
        uid = int(message.from_user.id) if message.from_user else None
        return uid in self.admins if uid is not None else False
