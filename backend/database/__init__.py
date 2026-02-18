"""Database package initialization"""
from .mongodb import MongoDB, get_database

__all__ = ["MongoDB", "get_database"]
