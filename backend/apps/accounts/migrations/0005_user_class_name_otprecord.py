from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_avatar'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='class_name',
            field=models.CharField(blank=True, max_length=50, verbose_name='Lớp học'),
        ),
        migrations.CreateModel(
            name='OTPRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('otp', models.CharField(max_length=6)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_used', models.BooleanField(default=False)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
