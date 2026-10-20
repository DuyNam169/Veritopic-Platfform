from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0005_major_academicyear_end_date_academicyear_is_active_and_more'),
        ('topics', '0010_topic_architecture_topic_created_by_topic_major_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='StudentTopicProposal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=500)),
                ('description', models.TextField(blank=True)),
                ('expected_technologies', models.CharField(blank=True, help_text='Công nghệ dự kiến', max_length=255)),
                ('status', models.CharField(choices=[('pending', 'Chờ GVHD xử lý'), ('approved', 'GVHD đã đồng ý'), ('rejected', 'GVHD từ chối'), ('revision_requested', 'Yêu cầu chỉnh sửa')], default='pending', max_length=30)),
                ('teacher_note', models.TextField(blank=True, help_text='Phản hồi/nhận xét của GVHD')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('academic_year', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='student_proposals', to='academics.academicyear')),
                ('cohort', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='student_proposals', to='academics.cohort')),
                ('created_topic', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='from_student_proposal', to='topics.topic')),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='student_proposals', to='academics.department')),
                ('field', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='student_proposals', to='academics.field')),
                ('semester', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='student_proposals', to='academics.semester')),
                ('student', models.ForeignKey(limit_choices_to={'role': 'student'}, on_delete=django.db.models.deletion.CASCADE, related_name='student_topic_proposals', to=settings.AUTH_USER_MODEL)),
                ('teacher', models.ForeignKey(limit_choices_to={'role': 'teacher'}, on_delete=django.db.models.deletion.CASCADE, related_name='received_topic_proposals', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TopicRegistration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Chờ duyệt'), ('approved', 'Đã duyệt'), ('rejected', 'Từ chối'), ('cancelled', 'Đã hủy')], default='pending', max_length=20)),
                ('note', models.TextField(blank=True, help_text='Ghi chú nguyện vọng của sinh viên khi đăng ký')),
                ('teacher_note', models.TextField(blank=True, help_text='Phản hồi của giảng viên')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.ForeignKey(limit_choices_to={'role': 'student'}, on_delete=django.db.models.deletion.CASCADE, related_name='topic_registrations', to=settings.AUTH_USER_MODEL)),
                ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registrations', to='topics.topic')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
