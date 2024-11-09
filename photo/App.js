import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import GalleryScreen from './GalleryScreen';
import GroupPhotosScreen from './GroupPhotosScreen';

const Tab = createBottomTabNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === 'Gallery') {
              iconName = 'camera';
            } else if (route.name === 'Group Photos') {
              iconName = 'folder';
            }
            return <Icon name={iconName} size={size} color={color} />;
          },
        })}
        tabBarOptions={{
          activeTintColor: 'tomato',
          inactiveTintColor: 'gray',
        }}
      >
        <Tab.Screen name="Gallery" component={GalleryScreen} />
        <Tab.Screen name="Group Photos" component={GroupPhotosScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default App;
