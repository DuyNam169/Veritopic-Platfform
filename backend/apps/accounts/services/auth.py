import random
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from ..models import OTPRecord

User = get_user_model()

def send_forgot_password_email(email: str) -> None:
    """Xử lý logic tạo OTP, lưu vào DB và gửi email."""
    # Sinh OTP 6 số
    otp = f"{random.randint(0, 999999):06d}"
    
    # Lưu vào DB
    OTPRecord.objects.create(email=email, otp=otp)

    # Gửi email
    send_mail(
        subject="Mã xác nhận lấy lại mật khẩu",
        message=f"Mã OTP của bạn là: {otp}\nMã này sẽ hết hạn sau 5 phút.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

def reset_user_password(email: str, otp: str, new_password: str) -> None:
    """Xử lý logic kiểm tra OTP và cập nhật mật khẩu mới."""
    time_threshold = timezone.now() - timedelta(minutes=5)
    otp_record = OTPRecord.objects.filter(
        email=email, 
        otp=otp, 
        is_used=False,
        created_at__gte=time_threshold
    ).order_by("-created_at").first()

    if not otp_record:
        raise ValueError("Mã OTP không hợp lệ hoặc đã hết hạn.")

    # Đổi mật khẩu
    user = User.objects.get(email=email)
    user.set_password(new_password)
    user.save()

    # Đánh dấu OTP đã dùng
    otp_record.is_used = True
    otp_record.save()

def change_user_password(user, old_password: str, new_password: str) -> None:
    """Xử lý logic kiểm tra mật khẩu cũ và cập nhật mật khẩu mới cho user đã đăng nhập."""
    if not user.check_password(old_password):
        raise ValueError("Mật khẩu cũ không chính xác.")
    
    user.set_password(new_password)
    user.save()
