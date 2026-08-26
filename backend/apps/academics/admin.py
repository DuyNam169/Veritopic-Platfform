from django.contrib import admin

from .models import AcademicYear, Cohort, Department, Field, Semester

admin.site.register(Cohort)
admin.site.register(AcademicYear)
admin.site.register(Semester)
admin.site.register(Department)
admin.site.register(Field)
