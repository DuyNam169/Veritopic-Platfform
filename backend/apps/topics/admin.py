from django.contrib import admin

from .models import (
    StudentTopicProposal,
    Technology,
    Topic,
    TopicAssignment,
    TopicDeletionAudit,
    TopicDocument,
    TopicFunction,
    TopicHistory,
    TopicRegistration,
    TopicSimilarityResult,
    TopicTechnology,
)

admin.site.register(Topic)
admin.site.register(TopicAssignment)
admin.site.register(TopicHistory)
admin.site.register(TopicDeletionAudit)
admin.site.register(TopicSimilarityResult)
admin.site.register(Technology)
admin.site.register(TopicTechnology)
admin.site.register(TopicFunction)
admin.site.register(TopicDocument)
admin.site.register(StudentTopicProposal)
admin.site.register(TopicRegistration)
