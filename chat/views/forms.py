from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from phonenumber_field.phonenumber import to_python
from .models import Profile
from django.contrib.auth import get_user_model
import os
from django.conf import settings

User = get_user_model()

class SignUpForm(UserCreationForm):
    phone_number = forms.CharField(widget=forms.TextInput(attrs={'placeholder': 'Phone Number'}))
    profile_picture = forms.ImageField(required=False)

    class Meta:
        model = User
        fields = ["username", "phone_number", "password1", "password2"]
        widgets = {
            "username": forms.TextInput(attrs={"placeholder": "Username"}),
            "password1": forms.PasswordInput(attrs={"placeholder": "Password"}),
            "password2": forms.PasswordInput(attrs={"placeholder": "Confirm Password"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].validators = [
            RegexValidator(
                regex=r'^[\w\s]+$',
                message="Username can only contain letters, numbers, and spaces.",
                code="invalid_username"
            )
        ]

    def clean_username(self):
        username = self.cleaned_data.get("username")
        if username:
            return username.strip()
        return username

    def clean_phone_number(self):
        phone_number = self.cleaned_data.get("phone_number")
        if phone_number:
            phone_number = to_python(phone_number)
            if not phone_number.is_valid():
                raise ValidationError("Enter a valid phone number.")
            if User.objects.filter(phone_number=phone_number).exists():
                raise ValidationError("This phone number is already in use.")
            return phone_number
        return phone_number

    def save(self, commit=True):
        user = super().save(commit=False)
        user.phone_number = self.cleaned_data["phone_number"]

        if commit:
            user.save()
            profile = Profile.objects.create(user=user)

            # Upload the image to Cloudinary if provided
            if "profile_picture" in self.cleaned_data and self.cleaned_data["profile_picture"]:
                profile.profile_picture = self.cleaned_data["profile_picture"]

            # The frontend will automatically show the default image using onerror.
            profile.save()

        return user