from django.db.models import Q


def scope_assignments(queryset, user):
    if user.role == "admin":
        return queryset
    if user.role == "department_head":
        return queryset.filter(topic__department_id=user.department_id) if user.department_id else queryset.none()
    if user.role == "teacher":
        return queryset.filter(Q(topic__proposed_by=user) | Q(assigned_by=user)).distinct()
    if user.role == "student":
        return queryset.filter(students=user).distinct()
    return queryset.none()
