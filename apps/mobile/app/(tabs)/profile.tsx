import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { trpc } from "../../lib/trpc";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { data: user, isLoading } = trpc.user.getMe.useQuery();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 px-5 py-6">
        <Text className="text-2xl font-bold text-gray-900 text-right mb-6">الملف الشخصي</Text>

        {isLoading ? (
          <Text className="text-gray-500 text-right">جاري التحميل...</Text>
        ) : user ? (
          <View className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <Text className="text-lg font-semibold text-gray-900 text-right mb-1">
              {user.name ?? "المستخدم"}
            </Text>
            <Text className="text-gray-500 text-right">{user.email}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className="bg-red-50 rounded-xl py-4 items-center"
          onPress={() => signOut()}
        >
          <Text className="text-red-600 font-semibold">تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
