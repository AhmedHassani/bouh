import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-5 py-6">
        <Text className="text-3xl font-bold text-gray-900 text-right mb-2">مساحة بوح</Text>
        <Text className="text-gray-500 text-right mb-8">مساحتك الآمنة للتعبير</Text>

        <View className="bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 text-right mb-2">
            ما الذي يدور في ذهنك؟
          </Text>
          <Text className="text-gray-500 text-right text-sm">
            هذه مساحتك — عبّر بحرية.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
