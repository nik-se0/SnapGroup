import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, Text, Dimensions, TouchableOpacity, Modal, Button, ActivityIndicator, BackHandler } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import Icon from 'react-native-vector-icons/Ionicons';
import DropDownPicker from 'react-native-dropdown-picker';
import {showMoveConfirmation, handleGroupPhotosQuick, handleGroupPhotosCache, handleGroupPhotosColor, handleGroupWhileColorHistogram} from './Other';
import Slider from '@react-native-community/slider';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native'


const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const GroupPhotosScreen = ({ route, navigation }) => {
  const [groupedPhotos, setGroupedPhotos] = useState([]);
  const [displayedPhotos, setDisplayedPhotos] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [similarityPercentage, setSimilarityPercentage] = useState(40);
  const [isGrouping, setIsGrouping] = useState(false);
  const [PrVisible, setPrVisible] = useState(false);
  const [ImVisible, setImVisible] = useState(false);
  const [doneVisible, setDoneVisible] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('quick_pixel');
  const [open, setOpen] = useState(false);
  const [methods, setMethods] = useState([
    { label: 'Быстрое пиксельное сравнение', value: 'quick_pixel' },
    { label: 'Быстрая цветовая гистограмма', value: 'quick_color_histogram' },
    { label: 'Пиксельное сравнение', value: 'pixel'},
    { label: 'Цветовая гистограмма', value: 'color_histogram' },
    { label: 'Рекурсивное сравнение', value: 'recursive' }
  ]);
  const { albums, clearSelectedAlbums } = route.params || {};
  const [selectedImage, setSelectedImage] = useState(null);
  const [data, setData] = useState({ albums: [], photos: [] });
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (route.params?.showModal) {
      setPrVisible(true);
      setSimilarityPercentage(40); // Задаем начальное значение 50%
    }
  }, [route.params]);

  useEffect(() => {
    const backAction = () => {
      if (selectedImages.length > 0) {
        setSelectedImages([]);
        return true;
      }
      if (ImVisible) {
        setSelectedImage(null);
        setImVisible(null);
        return true;
      }
      if (PrVisible) {
        setPrVisible(false);
        return true;
      }
      if (doneVisible) {
        setDoneVisible(false);
        return true;
      }
      if (displayedPhotos) {
        setDisplayedPhotos(null);
        return true;
      }
      return false;
    };

  const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
  return () => backHandler.remove();
}, [selectedImages, PrVisible, doneVisible, ImVisible, displayedPhotos, selectedImage]);


const handleGroupPhotosWrapper = async (cacheFlag=0) => {
  setPrVisible(false);
  setIsGrouping(true);
  setDisplayedPhotos(null);
  const photos = displayedPhotos ? displayedPhotos : await getAllPhotosFromAlbums(albums);
  switch (selectedMethod) {
    case 'quick_pixel':
      await handleGroupPhotosQuick(photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, 'pixel');
      break;
    case 'quick_color_histogram':
      await handleGroupPhotosQuick(photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, 'color_histogram');
      break;
    case 'pixel':
      await handleGroupPhotosCache(photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, 'pixel', cacheFlag);
      break;
    case 'color_histogram':
      await handleGroupPhotosCache(photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, 'color_histogram', cacheFlag);
      break;
    case 'recursive':
      await handleGroupWhileColorHistogram(photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, 'color_histogram', cacheFlag);
      break;
    default:
      break;
  }
  setDoneVisible(true);
  setIsGrouping(false);
};

  const getAllPhotosFromAlbums = async (albums) => {
    const photos = [];
    for (const album of albums) {
      const albumPhotos = await MediaLibrary.getAssetsAsync({ album: album.id, mediaType: 'photo', first: 40000 });
      photos.push(...albumPhotos.assets);
    }
    return photos.map(photo => ({ id: photo.id, uri: photo.uri }));
  };

  const handleFolderPress = (index) => {
    setDisplayedPhotos(groupedPhotos[index]);
  };

  const openPercentageModal = () => {
    setPrVisible(true);
  };

  const handleSliderChange = (value) => {
    setSimilarityPercentage(value);
  };

  const handleImageLongPress = (uri) => {
    if (selectedImages.includes(uri)) {
      setSelectedImages(selectedImages.filter((image) => image !== uri));
    } else {
     setSelectedImages([...selectedImages, uri]);
    }
  };

  const handleImageClick = (uri) => {
    if (selectedImages.length > 0) {
      if (selectedImages.includes(uri)) {
        setSelectedImages(selectedImages.filter((image) => image !== uri));
      } else {
        setSelectedImages([...selectedImages, uri]);
      }
    } else {
      setSelectedImage(uri);
      setImVisible(true);
    }
  };

const shareImages = async (selectedImages, setSelectedImages) => {
  if (selectedImages.length > 0) {
    try {
      for (const image of selectedImages) {
        const fileUri = image.startsWith('file://') ? image : `${FileSystem.cacheDirectory}${image.split('/').pop()}`;
        if (!fileUri.startsWith('file://')) {
          await FileSystem.downloadAsync(image, fileUri);
        }
        await Sharing.shareAsync(fileUri);
      }
      setSelectedImages([]); // Снятие выделения с фотографий после отправки
    } catch (error) {
      console.error('Ошибка при отправке изображений:', error);
      Alert.alert('Ошибка', 'Не удалось поделиться изображениями. Пожалуйста, попробуйте еще раз.');
    }
  } else {
    Alert.alert('Нет выбранных изображений', 'Пожалуйста, выберите изображения для отправки.');
  }
};


return (
  <View style={styles.container}>
    {displayedPhotos ? (
      <View>
        <FlatList
          data={displayedPhotos}
          keyExtractor={(item) => item.id}
          numColumns={4}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleImageClick(item.uri)}
              onLongPress={() => handleImageLongPress(item.uri)}
              style={[
                styles.imageContainer,
                selectedImages.includes(item.uri) && styles.selectedImageContainer,
              ]}
            >
              <Image source={{ uri: item.uri }} style={[styles.image, { width: screenWidth / 4.1, height: screenWidth / 4.1 }]} />
            </TouchableOpacity>
          )}
        />
        <View style={styles.sliderContainer2}>
          <TouchableOpacity style={styles.fab} onPress={() => openPercentageModal()}>
            <Icon name="options" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    ) : (
      <FlatList
        data={groupedPhotos}
        keyExtractor={(item, index) => index.toString()}
        numColumns={4}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.folder} onPress={() => handleFolderPress(index)}>
            <Icon name="folder" size={50} color="black" />
            <Text style={styles.folderText}>Папка {index + 1}</Text>
          </TouchableOpacity>
        )}
      />
    )}
    {!displayedPhotos && (
      <View>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={similarityPercentage}
            onValueChange={handleSliderChange}
            onSlidingComplete={() => handleGroupPhotosWrapper(1)}
            thumbTintColor="tomato"
            minimumTrackTintColor="tomato"
            maximumTrackTintColor="grey"
          />
          <Text style={styles.sliderValue}>{Math.round(similarityPercentage)}%</Text>
          <TouchableOpacity style={styles.fab} onPress={() => openPercentageModal()}>
            <Icon name="options" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    )}
    {selectedImages.length > 0 && (
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={() => showMoveConfirmation(selectedImages, data, setData, setSelectedImages)}>
          <Text style={styles.actionButtonText}>Переместить в корзину</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => shareImages(selectedImages, setSelectedImages)}>
          <Text style={styles.actionButtonText}>Поделиться</Text>
        </TouchableOpacity>
      </View>
    )}
    {isGrouping && (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="tomato" />
      </View>
    )}
    {PrVisible && (
      <Modal visible={PrVisible} transparent={true} animationType="slide" onRequestClose={() => setPrVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text>Выберите метод группировки:</Text>
            <DropDownPicker
              open={open}
              value={selectedMethod}
              items={methods}
              setOpen={setOpen}
              setValue={setSelectedMethod}
              setItems={setMethods}
              style={[styles.picker, styles.centerAlign]}
            />
            <View style={styles.spacer} />
            <Button title="Группировать" onPress={() => handleGroupPhotosWrapper(displayedPhotos ? displayedPhotos.map(photo => photo) : albums)} />
          </View>
        </View>
      </Modal>
    )}
    <Modal visible={doneVisible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text>Группировка завершена</Text>
          <Button title="OK" onPress={() => setDoneVisible(false)} />
        </View>
      </View>
    </Modal>
    {selectedImage && (
      <Modal visible={ImVisible} transparent={true} onRequestClose={() => setImVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalBackground} onPress={() => setImVisible(false)}>
            <Image source={{ uri: selectedImage }} style={styles.fullImage} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => showMoveConfirmation(selectedImage, data, setData, setSelectedImage)} style={styles.deleteButton}>
            <Icon name="trash-bin" size={30} color="tomato" />
          </TouchableOpacity>
        </View>
      </Modal>
    )}
  </View>
);

};

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Полупрозрачный фон
    zIndex: 1,
  },
  spacer: {
    height: 12,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    margin: 2,
  },
  folder: {
    width: screenWidth / 4,
    height: screenWidth / 4,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
  },
  folderText: {
    marginTop: 5,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight,
    resizeMode: 'contain',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  sliderContainer: {
    position: 'absolute',
    left: 50,
    //bottom: 1,
    top: -280,
    height: screenHeight / 2, // Высота контейнера для ползунка
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderContainer2: {
    position: 'fixed',
    //right: 10,
    //bottom: 20,
    //height: screenHeight / 2, // Высота контейнера для ползунка
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  fab: {
    bottom: 20,
    width: 38,
    height: 38,
    backgroundColor: 'tomato',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    right: 10,
  },
  slider: {
    width: 200,
    height: 40,
    bottom: 130,
    right: 10,
    transform: [{ rotate: '270deg' }], // Поворот ползунка на 270 градусов
  },
  sliderValue: {
    color: 'black',
    fontSize: 12,
    bottom: 30,
    right: 10,
    //marginTop: 10,
    textAlign: 'center',
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
  },
  imageContainer: {
    margin: 0.3,
  },
  selectedImageContainer: {
    borderColor: 'tomato',
    borderWidth: 0.3,
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    padding: 10,
    backgroundColor: 'tomato',
    borderRadius: 5,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
  },
});

export default GroupPhotosScreen