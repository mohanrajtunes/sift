from django.urls import path
from . import views

urlpatterns = [
    path('repos/', views.create_repo),
    path('repos/<int:pk>/', views.RepoDetail.as_view()),
    path('repos/<int:repo_id>/search/', views.search),
    path('repos/<int:repo_id>/ask/', views.ask),
    path('repos/<int:repo_id>/agent/', views.agent),
]