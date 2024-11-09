import { Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

//Удаление и просмотрт фотографий
export const confirmDeletePhoto = async (selectedImage, data, setData, setSelectedImage) => {
  if (selectedImage) {
    const asset = data.photos.find(photo => photo.uri === selectedImage);
    if (asset) {
      try {
        await MediaLibrary.deleteAssetsAsync([asset.id]);
        setData(prev => ({ ...prev, photos: prev.photos.filter(photo => photo.id !== asset.id) }));
        setSelectedImage(null);
      } catch (error) {
        console.error('Ошибка при удалении фотографии:', error);
        Alert.alert('Ошибка', 'Не удалось удалить фотографию. Пожалуйста, попробуйте еще раз.');
      }
    }
  }
};
export const showDeleteConfirmation = (selectedImage, data, setData, setModalVisible, setSelectedImage) => {
  Alert.alert(
    "Удалить фотографию",
    "Вы уверены, что хотите удалить эту фотографию?",
    [
      { text: 'Нет', style: 'cancel' },
      { text: 'Удалить', onPress: () => confirmDeletePhoto(selectedImage, data, setData, setModalVisible, setSelectedImage), style: 'destructive' },
    ],
    { cancelable: true }
  );
};

// Перемещение фотографий в папку "Корзина"
export const moveToTrash = async (selectedImages, data, setData, setSelectedImages) => {
  try {
    const trashDirectory = `${FileSystem.documentDirectory}Trash/`;
    const dirInfo = await FileSystem.getInfoAsync(trashDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(trashDirectory);
    }

    for (const selectedImage of selectedImages) {
      const asset = data.photos.find(photo => photo.uri === selectedImage);
      if (asset) {
        const newUri = `${trashDirectory}${asset.filename}`;
        await FileSystem.moveAsync({
          from: asset.uri,
          to: newUri
        });
        setData(prev => ({
          ...prev,
          photos: prev.photos.filter(photo => photo.id !== asset.id)
        }));
      }
    }
    setSelectedImages([]);
  } catch (error) {
    console.error('Ошибка при перемещении фотографий:', error);
    Alert.alert('Ошибка', 'Не удалось переместить фотографии в корзину. Пожалуйста, попробуйте еще раз.');
  }
};
export const showMoveConfirmation = (selectedImages, data, setData, setSelectedImages) => {
  Alert.alert(
    `Переместить ${selectedImages.length > 1 ? 'фотографии' : 'фотографию'} в корзину`,
    `Вы уверены, что хотите переместить ${selectedImages.length > 1 ? 'эти фотографии' : 'эту фотографию'} в корзину?`,
    [
      { text: 'Нет', style: 'cancel' },
      { text: 'Переместить', onPress: () => moveToTrash(selectedImages, data, setData, setSelectedImages), style: 'destructive' },
    ],
    { cancelable: true }
  );
};


// Общая функция для получения base64 изображения
const getBase64 = async (uri) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
const compareImages = async (base64Image1, base64Image2, selectedMethod) => {
  const endpoint = 'https://yoursever/compare';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image1: base64Image1, image2: base64Image2, method: selectedMethod }),
  });
  const result = await response.json();
  return result.similarity;
};

// Функция для группировки методом "quick"
export const handleGroupPhotosQuick = async (photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, selectedMethod) => {
  console.log('quick', selectedMethod); 
  const startTime = Date.now();
  setIsGrouping(true);
  const resizeOptionsSmall = {resize: { width:30, height:30}};
  const base64Images = await Promise.all(photos.map(async (photo) => {
  const manipResult = await ImageManipulator.manipulateAsync(photo.uri, [resizeOptionsSmall]);
    return {
      id: photo.id,
      originalUri: photo.uri,
      compressedUri: manipResult.uri,
      base64: await getBase64(manipResult.uri)
    };
  }));
  const groups = [];
  const groupedImageIds = new Set();
  while (base64Images.length) {
    const baseImage = base64Images.pop();
    if (groupedImageIds.has(baseImage.id)) continue;
    const group = [baseImage];
    groupedImageIds.add(baseImage.id);
    const promises = base64Images.map(async (image, index) => {
      if (groupedImageIds.has(image.id)) return;
      const isSimilar = await compareImages(baseImage.base64, image.base64, selectedMethod);
      if (isSimilar >= similarityPercentage) {
        group.push(image);
        groupedImageIds.add(image.id);
        base64Images.splice(index, 1);
      }
    });
    await Promise.all(promises);
    if (group.length > 1) {
      groups.push(group);
    }
  }
  // Отображение исходных изображений пользователю
  const groupedPhotosWithOriginals = groups.map(group => group.map(image => ({
    id: image.id,
    uri: image.originalUri
  })));
  setGroupedPhotos(groupedPhotosWithOriginals);
  setIsGrouping(false);
  const endTime = Date.now();
  console.log(`Время группировки: ${(endTime - startTime) / 1000} секунд`);
  clearSelectedAlbums();
};

let globalCache = {}; // Функция для группировки методом "cache"
export const handleGroupPhotosCache = async (photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, selectedMethod, cacheFlag) => {
  console.log('cache', selectedMethod);
  const startTime = Date.now();
  setIsGrouping(true);
  const resizeOptionsLarge = { resize: { width: 384, height: 512 } };
  const base64Images = await Promise.all(photos.map(async (photo) => {
    const manipResult = await ImageManipulator.manipulateAsync(photo.uri, [resizeOptionsLarge]);
    return {
      id: photo.id,
      originalUri: photo.uri,
      compressedUri: manipResult.uri,
      base64: await getBase64(manipResult.uri)
    };
  }));
  base64Images.sort((a, b) => a.id.localeCompare(b.id)); // Сортировка изображений в алфавитном порядке по их id
  const groups = [];
  const groupedImageIds = new Set();
  if (cacheFlag != 1) { globalCache = {};} // Очистка кеша, если флаг равен 0
  while (base64Images.length) {
    const baseImage = base64Images.pop();
    if (groupedImageIds.has(baseImage.id)) continue;
    const group = [baseImage];
    groupedImageIds.add(baseImage.id);
    const promises = base64Images.map(async (image, index) => {
      if (groupedImageIds.has(image.id)) return;
      const cacheKey = `${baseImage.id}_${image.id}`;
      let isSimilar;
      if (cacheKey in globalCache) {
        isSimilar = globalCache[cacheKey]; // Использование кеша
      } else {
        isSimilar = await compareImages(baseImage.base64, image.base64, similarityPercentage, selectedMethod);
        globalCache[cacheKey] = isSimilar; // Сохранение в кеш
      }
      if (isSimilar >= similarityPercentage) {
        group.push(image);
        groupedImageIds.add(image.id);
        base64Images.splice(index, 1);
      }
    });
    await Promise.all(promises);
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  // Отображение исходных изображений пользователю
  const groupedPhotosWithOriginals = groups.map(group => group.map(image => ({
    id: image.id,
    uri: image.originalUri
  })));
  setGroupedPhotos(groupedPhotosWithOriginals);
  setIsGrouping(false);
  const endTime = Date.now();
  console.log(`Время группировки: ${(endTime - startTime) / 1000} секунд`);
  clearSelectedAlbums();
};




// Рекурсивная функция для группировки методом "color_histogram"
export const handleGroupWhileColorHistogram = async (photos, similarityPercentage, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, selectedMethod, cacheFlag) => {
    let currentCompression = 10;
    const startTime = Date.now();
    setIsGrouping(true);
    const resizeOptionsLarge = { resize: { width: currentCompression, height: currentCompression } };
    const base64Images = await Promise.all(photos.map(async (photo) => {
        const manipResult = await ImageManipulator.manipulateAsync(photo.uri, [resizeOptionsLarge]);
        return { 
          id: photo.id, 
          originalUri: photo.uri, 
          compressedUri: manipResult.uri, 
          base64: await getBase64(manipResult.uri)};
    }));
    let groups = [];
    const groupedImageIds = new Set();
    while (base64Images.length) {
        const baseImage = base64Images.pop();
        if (groupedImageIds.has(baseImage.id)) continue;
        const group = [baseImage];
        groupedImageIds.add(baseImage.id);
        await Promise.all(base64Images.map(async (image, index) => {
            if (groupedImageIds.has(image.id)) return;
            const isSimilar = await compareImages(baseImage.base64, image.base64, 'color_histogram');
            if (isSimilar >= similarityPercentage) {
                group.push(image);
                groupedImageIds.add(image.id);
                base64Images.splice(index, 1);
            }
        }));
        if (group.length > 1) groups.push(group);
    }
    const finalGroups = [];
    let queue = [];
    do {
        let n = 0;
        groups = groups.filter(group => {
            if (group.length > 7) {
                queue.push(group); console.log('Push queue groups:', group.length);
                return false;
            } else {
                finalGroups.push(group); console.log('Push final groups:', group.length);
                n++;
                return false;
            }
        });
        if (n == 0) currentCompression += 5;
        while (queue.length > 0) {
            let currentGroup = queue.pop();
            if (n == 0) {
              currentGroup = await Promise.all(currentGroup.map(async (photo) => {
                const manipResult = await ImageManipulator.manipulateAsync(photo.originalUri, [{ resize: { width: currentCompression, height: currentCompression } }]);
                photo.compressedUri = manipResult.uri;
                photo.base64 = await getBase64(manipResult.uri);
                return photo;
              }));
            }
            const groupMap = new Map();
            const groupedImageIds = new Set();
            while (currentGroup.length) {
                const baseImage = currentGroup.pop();
                let isAddedToFinalGroup = false;
                for (const finalGroup of finalGroups) {
                     if (finalGroup.length > 0) {
                      const finalImage = finalGroup[0];
                      const finalManipResult = await ImageManipulator.manipulateAsync(finalImage.originalUri, [{ resize: { width: currentCompression, height: currentCompression } }]);
                      finalImage.compressedUri = finalManipResult.uri;
                      finalImage.base64 = await getBase64(finalManipResult.uri);
                    const isSimilar = await compareImages(baseImage.base64, finalImage.base64, selectedMethod);
                    if (isSimilar >= 70) {
                        finalGroup.push(baseImage);
                        groupedImageIds.add(baseImage.id);
                        isAddedToFinalGroup = true;
                        console.log('Push baseImage in final groups');
                        break;
                    }
                     }
                }
                if (isAddedToFinalGroup) continue;
                if (groupedImageIds.has(baseImage.id)) continue;
                const group = groupMap.get(baseImage.id) || [baseImage];
                groupedImageIds.add(baseImage.id);
                await Promise.all(currentGroup.map(async (image, index) => {
                    if (groupedImageIds.has(image.id)) return;
                    selectedMethod = (index % 2 === 0) ? 'color_histogram' : 'quick';
                    const isSimilar = await compareImages(baseImage.base64, image.base64, selectedMethod);
                    if (isSimilar >= similarityPercentage) {
                        group.push(image);
                        groupedImageIds.add(image.id);
                        currentGroup.splice(index, 1);
                    }
                }));
                if (group.length > 1) groups.push(group);
            }
        }
    } while (currentCompression < 70);
    finalGroups.push(...groups);
    const groupedPhotosWithOriginals = finalGroups.map(group => group.map(image => ({ id: image.id, uri: image.originalUri })));
    setGroupedPhotos(groupedPhotosWithOriginals);
    setIsGrouping(false);
    const endTime = Date.now();
    console.log(`Время группировки: ${(endTime - startTime) / 1000} секунд`);
    clearSelectedAlbums();
};


// Базовая функция для группировки фотографий
const handleGroupPhotosBase = async (photos, similarityPercentage, selectedMethod, setGroupedPhotos, setIsGrouping, clearSelectedAlbums, cacheFlag) => {
  const startTime = Date.now();
  setIsGrouping(true);
  const resizePercentage = Math.max(10, similarityPercentage);
  const resizeOptions = { resize: { width: resizePercentage || 1, height: resizePercentage || 1 } };
  const base64Images = await Promise.all(photos.map(async (photo) => {
    const manipResult = await ImageManipulator.manipulateAsync(photo.uri, [resizeOptions]);
    return {
      id: photo.id,
      originalUri: photo.uri, // Сохранение исходного URI для отображения пользователю
      compressedUri: manipResult.uri,
      base64: await getBase64(manipResult.uri)
    };
  }));
  const groups = [];
  const groupedImageIds = new Set();
  while (base64Images.length) {
    const baseImage = base64Images.pop();
    if (groupedImageIds.has(baseImage.id)) continue;
    const group = [baseImage];
    groupedImageIds.add(baseImage.id);
    const promises = base64Images.map(async (image, index) => {
      if (groupedImageIds.has(image.id)) return;
      const isSimilar = await compareImages(baseImage.base64, image.base64, similarityPercentage, selectedMethod);
      if (isSimilar) {
        group.push(image);
        groupedImageIds.add(image.id);
        base64Images.splice(index, 1);
      }
    });
    await Promise.all(promises);
    if (group.length > 1) {
      groups.push(group);
    }
  }
  // Отображение исходных изображений пользователю
  const groupedPhotosWithOriginals = groups.map(group => group.map(image => ({
    id: image.id,
    uri: image.originalUri
  })));
  setGroupedPhotos(groupedPhotosWithOriginals);
  setIsGrouping(false);
  const endTime = Date.now();
  console.log(`Время группировки: ${(endTime - startTime) / 1000} секунд`);
  clearSelectedAlbums();
};


