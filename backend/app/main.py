from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import auth, categories, enquiries, images, materials, orders, pages, products

settings = get_settings()

app = FastAPI(
    title="Collection Noir API",
    description=(
        "Catalogue and content service for collectionnoir.com. "
        "Product data, imagery and page copy are held here and edited through "
        "the admin console, so changes need no redeploy."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,  # required for the admin session cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(materials.router)
app.include_router(images.router)
app.include_router(pages.router)
app.include_router(enquiries.router)
app.include_router(orders.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
