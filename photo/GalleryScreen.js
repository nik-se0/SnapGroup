import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, Text, Dimensions, TouchableOpacity, Modal, BackHandler, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import Icon from 'react-native-vector-icons/Ionicons';
import {showMoveConfirmation} from './Other';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const GalleryScreen = ({ navigation }) => {
  const [data, setData] = useState({ albums: [], photos: [] });
  const [hasPermission, setHasPermission] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedAlbums, setSelectedAlbums] = useState([]);
  const [showGroupButton, setShowGroupButton] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status === 'granted') {
        const albums = await MediaLibrary.getAlbumsAsync();
        const nonEmptyAlbums = [];
        for (const album of albums) {
          const albumPhotos = await MediaLibrary.getAssetsAsync({ album: album.id, mediaType: 'photo', first: 1 });
          if (albumPhotos.assets.length > 0) {
            nonEmptyAlbums.push(album);
          }
        }
        nonEmptyAlbums.sort((a, b) => a.title.localeCompare(b.title));
        setData(prev => ({ ...prev, albums: nonEmptyAlbums }));
      }
    })();
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (selectedAlbum) {
        setSelectedAlbum(null);
        setShowGroupButton(false);
        return true;
      } else if (selectedAlbums.length > 0) {
        setSelectedAlbums([]);
        setShowGroupButton(false);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedAlbum, selectedAlbums]);

  const handleAlbumPress = async (album) => {
    if (selectedAlbums.length === 0) {
      setSelectedAlbum(album);
      const albumPhotos = await MediaLibrary.getAssetsAsync({ album: album.id, mediaType: 'photo', first: 9999, sortBy: [['creationTime', false]] });
      setData(prev => ({ ...prev, photos: albumPhotos.assets }));
      setShowGroupButton(false);
    } else {
      handleLongPressAlbum(album);
    }
  };

  const handleLongPressAlbum = (album) => {
    setSelectedAlbums((prevSelected) => {
      const isSelected = prevSelected.includes(album);
      if (isSelected) {
        return prevSelected.filter((a) => a !== album);
      } else {
        return [...prevSelected, album];
      }
    });
    setShowGroupButton(true);
  };

  const clearSelectedAlbums = () => {
    setSelectedAlbums([]);
    setShowGroupButton(false);
  };

  if (hasPermission === null) {
    return <Text>Запрашиваем разрешение...</Text>;
  }

  if (hasPermission === false) {
    return <Text>Нет доступа к медиатеке</Text>;
  }

const handleImagePress = (uri, setSelectedImage, setModalVisible) => {
  setSelectedImage(uri);
  setModalVisible(true);
};

  return (
    <View style={styles.container}>
      {selectedAlbum ? (
        <>
          <Text style={styles.albumTitle}>{selectedAlbum.title}</Text>
          <FlatList
            data={data.photos}
            key={`photos_${selectedAlbum.id}`}
            numColumns={4}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleImagePress(item.uri, setSelectedImage, setModalVisible)}>
                <Image source={{ uri: item.uri }} style={[styles.image, { width: screenWidth / 4.1, height: screenWidth / 4.1 }]} />
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        <FlatList
          data={data.albums}
          key="albums"
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleAlbumPress(item)}
              onLongPress={() => handleLongPressAlbum(item)}
              style={[styles.albumTile, selectedAlbums.includes(item) && styles.selectedAlbum]}
            >
              <Text style={styles.albumName} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      {selectedImage && (
        <Modal visible={modalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalBackground} onPress={() => setModalVisible(false)}>
              <Image source={{ uri: selectedImage }} style={styles.fullImage} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => showMoveConfirmation (selectedImage, data, setData, setSelectedImage)} style={styles.deleteButton}>
              <Icon name="trash-bin" size={30} color="tomato" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
      {showGroupButton && (
        <View style={styles.groupButtonContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('Group Photos', { albums: selectedAlbums, clearSelectedAlbums, showModal: true })}>
            <Text style={styles.groupButtonText}>Группировка</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  image: {
    margin: 2,
  },
  albumTile: {
    flex: 1,
    margin: 2,
    padding: -10,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    height: screenHeight / 11,
  },
  selectedAlbum: {
    backgroundColor: '#aaf',
  },
  albumName: {
    textAlign: 'center',
    marginTop: 10,
  },
  albumTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 20,
    padding: -10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight,
    resizeMode: 'contain',
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
  deleteButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  groupButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  groupButtonText: {
    backgroundColor: 'tomato',
    color: 'white',
    padding: 10,
    borderRadius: 5,
  },
});

export default GalleryScreen;
