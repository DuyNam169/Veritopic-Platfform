from rest_framework.pagination import PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    """Phân trang mặc định cho toàn bộ API. Cho phép Client tự chọn page_size qua query param."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
