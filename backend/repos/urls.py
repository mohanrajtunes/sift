from django.urls import path
from . import views

urlpatterns = [
    path('repos/', views.repos),
    path('repos/<int:pk>/', views.RepoDetail.as_view()),
    path('repos/<int:repo_id>/graph/', views.graph),
    path('repos/<int:repo_id>/search/', views.search),
    path('repos/<int:repo_id>/ask/', views.ask),
    path('repos/<int:repo_id>/agent/', views.agent),
    path('repos/<int:repo_id>/agent/stream/', views.agent_stream),
    path('repos/<int:repo_id>/file/', views.file_lines),
    path('evals/', views.evals),
]
