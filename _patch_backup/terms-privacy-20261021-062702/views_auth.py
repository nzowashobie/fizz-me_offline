"""
views_auth.py — Signup, login redirect, and RSA key provisioning.
"""

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from django.contrib.auth import login, get_user_model
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect

from ..forms import SignUpForm
from ..models import Contact

User = get_user_model()


def signup_view(request):
    if request.method == "POST":
        form = SignUpForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save()

            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            public_key  = private_key.public_key()

            public_pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode()
            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            ).decode()

            user.public_key = public_pem
            user.save()

            login(request, user)
            request.session['_tmp_private_key'] = private_pem
            return redirect("chat-page")
    else:
        form = SignUpForm()

    return render(request, "signup.html", {"form": form})


@login_required
def chat_view(request):
    contact_ids  = Contact.objects.filter(owner=request.user).values_list('contact_user_id', flat=True)
    users        = User.objects.filter(id__in=contact_ids).exclude(id=request.user.id)
    private_key  = request.session.pop('_tmp_private_key', None)
    return render(request, 'index.html', {'users': users, 'private_key': private_key})


@login_required
def get_public_key(request):
    from django.http import JsonResponse
    from ..models import CustomUser

    username = request.GET.get('username', '').strip()
    try:
        user = CustomUser.objects.get(username=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    if not user.public_key:
        return JsonResponse({'error': 'No public key registered for this user'}, status=404)
    return JsonResponse({'username': username, 'public_key': user.public_key})
