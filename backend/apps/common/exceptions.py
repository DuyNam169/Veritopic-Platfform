from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Chuẩn hóa format lỗi trả về cho toàn bộ API, giúp Frontend xử lý lỗi nhất quán:
    { "detail": "...", "code": "..." }
    """
    response = exception_handler(exc, context)

    if response is not None:
        response.data["status_code"] = response.status_code

    return response
