from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "KennaDent · Plataforma"
admin.site.site_title = "KennaDent"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("nucleo.api.urls")),
]
