from django.contrib import admin

from .models import Topic, TopicAssignment, TopicHistory, TopicSimilarityResult

admin.site.register(Topic)
admin.site.register(TopicAssignment)
admin.site.register(TopicHistory)
admin.site.register(TopicSimilarityResult)
