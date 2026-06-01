import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "حدث خطأ";
      Alert.alert("خطأ", message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "رمز التحقق غير صحيح";
      Alert.alert("خطأ", message);
    } finally {
      setLoading(false);
    }
  }

  if (pendingVerification) {
    return (
      <View className="flex-1 bg-white justify-center px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2 text-right">تحقق من بريدك</Text>
        <Text className="text-gray-500 mb-8 text-right">أدخل الرمز المرسل إلى {email}</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 mb-6 text-center text-xl tracking-widest"
          placeholder="000000"
          value={code}
          onChangeText={setCode}
          keyboardType="numeric"
          maxLength={6}
        />
        <TouchableOpacity
          className="bg-indigo-600 rounded-xl py-4 items-center"
          onPress={handleVerify}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-base">
            {loading ? "جاري التحقق..." : "تحقق"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white justify-center px-6">
      <Text className="text-3xl font-bold text-gray-900 mb-2 text-right">إنشاء حساب</Text>
      <Text className="text-gray-500 mb-8 text-right">انضم إلى مساحة بوح</Text>

      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-right"
        placeholder="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 mb-6 text-right"
        placeholder="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        className="bg-indigo-600 rounded-xl py-4 items-center mb-4"
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? "جاري الإنشاء..." : "إنشاء حساب"}
        </Text>
      </TouchableOpacity>

      <Link href="/(auth)/sign-in" asChild>
        <TouchableOpacity className="items-center">
          <Text className="text-indigo-600">لديك حساب؟ سجل الدخول</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
