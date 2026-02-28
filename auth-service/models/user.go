package models

import "gorm.io/gorm"

type User struct {
	gorm.Model
	Email        string  `gorm:"uniqueIndex;not null" json:"email"`
	Password     *string `gorm:"default:null"        json:"password,omitempty"`
	AuthProvider string  `gorm:"default:'local'"     json:"auth_provider"`
	LinkedInID   *string `gorm:"default:null"        json:"linkedin_id,omitempty"`
	AvatarURL    *string `gorm:"default:null"        json:"avatar_url,omitempty"`
	FullName     *string `gorm:"default:null"        json:"full_name,omitempty"`
	Tier         string  `gorm:"default:'free'"      json:"tier"`
}
