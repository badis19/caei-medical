<?php
require 'vendor/autoload.php';

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'john.doe@example.com';
$password = 'password123';

$user = User::where('email', $email)->first();

if ($user) {
    if (Hash::check($password, $user->password)) {
        echo "Password is valid.";
    } else {
        echo "Invalid password.";
    }
} else {
    echo "User not found.";
}
?>
