from django.urls import path

from .views import ExportTopicsView, StatisticsOverviewView

urlpatterns = [
    path("overview/", StatisticsOverviewView.as_view(), name="statistics-overview"),
    path("export/", ExportTopicsView.as_view(), name="statistics-export"),
]
