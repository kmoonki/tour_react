import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { Heart, MapPin, BookmarkCheck, Search } from 'lucide-react';
import './App.css';

// 한국관광공사 지역코드 매핑
const AREA_CODES = [
  { code: '1', name: '서울' },
  { code: '2', name: '인천' },
  { code: '3', name: '대전' },
  { code: '4', name: '대구' },
  { code: '5', name: '광주' },
  { code: '6', name: '부산' },
  { code: '7', name: '울산' },
  { code: '8', name: '세종' },
  { code: '31', name: '경기' },
  { code: '32', name: '강원' },
  { code: '39', name: '제주' }
];

export default function App() {
  const [selectedArea, setSelectedArea] = useState('1'); // 기본값 서울
  const [tourList, setTourList] = useState([]);
  const [favorites, setFavorites] = useState({});
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' | 'favorites'
  const [loading, setLoading] = useState(false);

  // 1. Firebase Firestore 실시간 구독 (찜 목록 동기화)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'favorites'), (snapshot) => {
      const favs = {};
      snapshot.forEach((doc) => {
        favs[doc.id] = doc.data();
      });
      setFavorites(favs);
    });
    return () => unsub();
  }, []);

  // 2. 공공데이터포털 지역별 관광정보 API 호출
  const fetchTourData = async (areaCode) => {
    setLoading(true);
    const serviceKey = import.meta.env.VITE_TOUR_API_KEY;
    const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${encodeURIComponent(
      serviceKey
    )}&numOfRows=20&pageNo=1&MobileOS=ETC&MobileApp=TourApp&_type=json&arrange=O&areaCode=${areaCode}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const items = data.response?.body?.items?.item || [];
      setTourList(items);
    } catch (err) {
      console.error('관광데이터 로드 실패:', err);
      setTourList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTourData(selectedArea);
  }, [selectedArea]);

  // 3. 찜하기 토글 (Firestore 저장/삭제)
  const toggleFavorite = async (item) => {
    const contentId = String(item.contentid);
    const isFav = !!favorites[contentId];

    try {
      if (isFav) {
        // 이미 찜한 경우 -> 삭제
        await deleteDoc(doc(db, 'favorites', contentId));
      } else {
        // 찜하지 않은 경우 -> 데이터 추가
        await setDoc(doc(db, 'favorites', contentId), {
          contentid: contentId,
          title: item.title || '',
          addr1: item.addr1 || '',
          firstimage: item.firstimage || item.firstimage2 || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Firebase 업데이트 오류:', err);
    }
  };

  const favoriteList = Object.values(favorites);
  const displayItems = activeTab === 'explore' ? tourList : favoriteList;

  return (
    <div className="container">
      {/* 헤더 */}
      <header className="header">
        <h1>대한민국 구석구석 관광 여행</h1>
        <div className="tab-buttons">
          <button 
            className={activeTab === 'explore' ? 'active' : ''} 
            onClick={() => setActiveTab('explore')}
          >
            <Search size={16} /> 둘러보기
          </button>
          <button 
            className={activeTab === 'favorites' ? 'active' : ''} 
            onClick={() => setActiveTab('favorites')}
          >
            <BookmarkCheck size={16} /> 찜 보관함 ({favoriteList.length})
          </button>
        </div>
      </header>

      {/* 지역 선택 바 (둘러보기 모드일 때만 표시) */}
      {activeTab === 'explore' && (
        <section className="area-selector">
          {AREA_CODES.map((area) => (
            <button
              key={area.code}
              className={`area-btn ${selectedArea === area.code ? 'selected' : ''}`}
              onClick={() => setSelectedArea(area.code)}
            >
              {area.name}
            </button>
          ))}
        </section>
      )}

      {/* 로딩 표시 */}
      {loading && <div className="loader">데이터를 불러오는 중입니다...</div>}

      {/* 관광지 그리드 목록 뷰 */}
      {!loading && (
        <main className="grid-container">
          {displayItems.length === 0 ? (
            <div className="empty-state">
              {activeTab === 'explore' 
                ? '해당 지역의 관광 정보가 없습니다.' 
                : '보관된 찜 목록이 없습니다.'}
            </div>
          ) : (
            displayItems.map((item) => {
              const isFav = !!favorites[String(item.contentid)];
              const thumbnail = item.firstimage || item.firstimage2 || 'https://via.placeholder.com/300x200?text=No+Image';

              return (
                <div key={item.contentid} className="card">
                  <div className="image-wrapper">
                    <img src={thumbnail} alt={item.title} loading="lazy" />
                    <button
                      className={`favorite-btn ${isFav ? 'is-fav' : ''}`}
                      onClick={() => toggleFavorite(item)}
                      title={isFav ? "찜 취소" : "찜하기"}
                    >
                      <Heart size={20} fill={isFav ? "#e11d48" : "none"} color={isFav ? "#e11d48" : "#fff"} />
                    </button>
                  </div>
                  <div className="card-info">
                    <h3 className="card-title">{item.title}</h3>
                    <p className="card-addr">
                      <MapPin size={14} /> {item.addr1 || '주소 정보 없음'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </main>
      )}
    </div>
  );
}