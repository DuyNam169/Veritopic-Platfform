from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0005_major_academicyear_end_date_academicyear_is_active_and_more'),
        ('accounts', '0007_user_academic_degree_user_academic_year_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('notification_type', models.CharField(choices=[('advisor_request', 'Yêu cầu hướng dẫn'), ('advisor_response', 'Phản hồi hướng dẫn'), ('topic_proposal', 'Đề xuất đề tài'), ('topic_proposal_response', 'Phản hồi đề xuất đề tài'), ('topic_registration', 'Đăng ký đề tài'), ('topic_registration_response', 'Phản hồi đăng ký đề tài'), ('system', 'Hệ thống')], default='system', max_length=50)),
                ('link', models.CharField(blank=True, default='', max_length=255)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
                ('sender', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AdvisorRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Chờ phản hồi'), ('accepted', 'Đã đồng ý'), ('rejected', 'Từ chối'), ('cancelled', 'Đã hủy')], default='pending', max_length=20)),
                ('message', models.TextField(blank=True, help_text='Nguyện vọng/lời nhắn của sinh viên')),
                ('response_note', models.TextField(blank=True, help_text='Nhận xét/lý do phản hồi của giảng viên')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cohort', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='advisor_requests', to='academics.cohort')),
                ('semester', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='advisor_requests', to='academics.semester')),
                ('student', models.ForeignKey(limit_choices_to={'role': 'student'}, on_delete=django.db.models.deletion.CASCADE, related_name='advisor_requests', to=settings.AUTH_USER_MODEL)),
                ('teacher', models.ForeignKey(limit_choices_to={'role': 'teacher'}, on_delete=django.db.models.deletion.CASCADE, related_name='received_advisor_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
