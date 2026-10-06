from django.contrib import admin

from .models import Topic, TopicAssignment, TopicDeletionAudit, TopicHistory, TopicSimilarityResult

admin.site.register(Topic)
admin.site.register(TopicAssignment)
admin.site.register(TopicHistory)
admin.site.register(TopicDeletionAudit)
admin.site.register(TopicSimilarityResult)
