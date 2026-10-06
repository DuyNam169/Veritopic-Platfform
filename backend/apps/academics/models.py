from django.db import models, transaction


class Cohort(models.Model):
    """Khóa học, ví dụ: K64, K65..."""
    name = models.CharField(max_length=50, unique=True)
    start_year = models.PositiveIntegerField()
    end_year = models.PositiveIntegerField()

    class Meta:
        ordering = ["-start_year"]

    def __str__(self):
        return self.name


class AcademicYear(models.Model):
    """Năm học, ví dụ: 2025-2026."""
    name = models.CharField(max_length=20, unique=True)
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ["-name"]
        constraints = [models.UniqueConstraint(fields=["is_current"], condition=models.Q(is_current=True), name="one_current_academic_year")]

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.is_current:
                AcademicYear.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)
            super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Semester(models.Model):
    """Học kỳ trong một năm học, ví dụ: Học kỳ 1 - 2025-2026."""
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name="semesters")
    name = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        ordering = ["-start_date"]
        unique_together = ("academic_year", "name")

    def __str__(self):
        return f"{self.name} ({self.academic_year})"


class Department(models.Model):
    """Chuyên ngành / Bộ môn."""
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)
    head = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="headed_departments",
        limit_choices_to={"role": "department_head"},
        help_text="Trưởng bộ môn phụ trách",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Field(models.Model):
    """Lĩnh vực đề tài, ví dụ: Web, Mobile, AI, Nhúng... — dùng để thống kê theo lĩnh vực."""
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
