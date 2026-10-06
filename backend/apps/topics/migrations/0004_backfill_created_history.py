from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("topics", "0003_topicdeletionaudit"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                INSERT INTO topics_topichistory
                    (topic_id, action, actor_id, note, created_at)
                SELECT
                    topic.id,
                    'created',
                    topic.proposed_by_id,
                    'Khôi phục dấu vết tạo mới cho đề tài hiện có.',
                    topic.created_at
                FROM topics_topic AS topic
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM topics_topichistory AS history
                    WHERE history.topic_id = topic.id
                      AND history.action = 'created'
                );
            """,
            reverse_sql="""
                DELETE FROM topics_topichistory
                WHERE action = 'created'
                  AND note = 'Khôi phục dấu vết tạo mới cho đề tài hiện có.';
            """,
        ),
    ]
