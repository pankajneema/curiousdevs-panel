from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Python stays snake_case; the JSON wire shape stays camelCase, matching
    the frontend's existing TypeScript types field-for-field."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
