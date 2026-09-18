/*
 * Copyright (c) 2010-2017 OTClient <https://github.com/edubart/otclient>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "uicreature.h"
#include "spritemanager.h"
#include <framework/otml/otml.h>
#include <framework/graphics/drawqueue.h>
void UICreature::drawSelf(Fw::DrawPane drawPane)
{
    if (drawPane != Fw::ForegroundPane)
        return;

    UIWidget::drawSelf(drawPane);

    if (m_creature)
    {
        if (m_autoRotating)
        {
            auto ticks = (g_clock.millis() % 4000) / 4;
            Otc::Direction new_dir;
            if (ticks < 250)
                new_dir = Otc::South;
            else if (ticks < 500)
                new_dir = Otc::East;
            else if (ticks < 750)
                new_dir = Otc::North;
            else
                new_dir = Otc::West;

            if (new_dir != m_direction)
                m_direction = new_dir;
        }

        Rect drawRect = getPaddingRect();
        Size widgetSize = getSize();
        drawRect.setSize(widgetSize);

        Point offset;
        if (m_centered)
        {
            offset.x = (widgetSize.width() - drawRect.width()) / 2;
            offset.y = (widgetSize.height() - drawRect.height()) / 2;
        }
        offset += m_customOffset;
        drawRect.translate(offset);

        ThingTypePtr thingType = m_creature->getThingType();
        int phases = thingType->getAnimationPhases();

        int animPhase = 0;
        if (m_animate && phases > 1)
            animPhase = (g_clock.millis() / 500) % phases;

        int spriteExactSize = thingType->getExactSize(0, 0, 0, 0, animPhase);

        float scale = 1.0f;

        if (spriteExactSize > 0)
        {
            scale = std::min(
                (float)widgetSize.width() / spriteExactSize,
                (float)widgetSize.height() / spriteExactSize);
        }

        if (spriteExactSize > 32)
        {
            scale *= 0.95f;
        }

        Size scaledSize = Size(spriteExactSize * scale, spriteExactSize * scale);

        if (scaledSize.width() > widgetSize.width() * 1.5f)
            scaledSize.setWidth(widgetSize.width() * 1.5f);
        if (scaledSize.height() > widgetSize.height() * 1.5f)
            scaledSize.setHeight(widgetSize.height() * 1.5f);

        if (scaledSize.width() > 0 && scaledSize.height() > 0)
        {
            Point newOffset;
            newOffset.x = (widgetSize.width() - scaledSize.width()) / 2;
            newOffset.y = (widgetSize.height() - scaledSize.height()) / 2;

            drawRect.setTopLeft(getPaddingRect().topLeft() + offset + newOffset);
            drawRect.setSize(scaledSize);
        }

        if (spriteExactSize > 32)
        {
            drawRect.translate(Point(-1, -1));
        }

        int maskLayer = 0;
        Color color = m_imageColor;

        int xPattern = 0;
        switch (m_direction)
        {
        case Otc::North:
            xPattern = 0;
            break;
        case Otc::East:
            xPattern = 1;
            break;
        case Otc::South:
            xPattern = 2;
            break;
        case Otc::West:
            xPattern = 3;
            break;
        default:
            xPattern = 0;
            break;
        }

        int yPattern = 0;
        
        std::string shader = m_creature->getOutfit().getShader();
        
        if (!shader.empty()) {
            
            std::shared_ptr<DrawOutfitParams> outfitParams = thingType->drawOutfit(
                drawRect.topLeft(), 
                0,
                m_direction, 
                yPattern, 
                0, 
                animPhase, 
                color, 
                nullptr);
                
            if (outfitParams) {
                Point center = outfitParams->dest.center();
                
                DrawQueueItemTexturedRect* outfit = new DrawQueueItemOutfitWithShader(
                    drawRect, 
                    outfitParams->texture, 
                    outfitParams->src, 
                    outfitParams->offset, 
                    center, 
                    0,
                    shader, 
                    true);
                g_drawQueue->add(outfit);
            }
        } else {
            thingType->drawOutfitInRect(
                drawRect,
                maskLayer,
                m_direction,
                xPattern,
                yPattern,
                animPhase,
                color,
                "");
        }
    }
}

void UICreature::luaSetCenterOffset(LuaInterface* lua)
{
    int y = lua->popInteger();
    int x = lua->popInteger();
    setCenterOffset(x, y);
}

void UICreature::luaGetCenterOffset(LuaInterface* lua)
{
    lua->pushInteger(m_customOffset.x);
    lua->pushInteger(m_customOffset.y);
}


void UICreature::setCenterOffset(int x, int y)
{
    m_customOffset.x = x;
    m_customOffset.y = y;
}

Point UICreature::getCenterOffset() const
{
    return m_customOffset;
}


void UICreature::setOutfit(const Outfit& outfit)
{
    if (!m_creature)
        m_creature = CreaturePtr(new Creature);
    m_direction = Otc::South;
    m_creature->setOutfit(outfit);
}

void UICreature::onStyleApply(const std::string& styleName, const OTMLNodePtr& styleNode)
{
    UIWidget::onStyleApply(styleName, styleNode);

    for (const OTMLNodePtr& node : styleNode->children()) {
        if (node->tag() == "fixed-creature-size")
            setFixedCreatureSize(node->value<bool>());
        else if (node->tag() == "outfit-id") {
            Outfit outfit = getOutfit();
            outfit.setId(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-head") {
            Outfit outfit = getOutfit();
            outfit.setHead(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-body") {
            Outfit outfit = getOutfit();
            outfit.setBody(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-legs") {
            Outfit outfit = getOutfit();
            outfit.setLegs(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-feet") {
            Outfit outfit = getOutfit();
            outfit.setFeet(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-addons") {
            Outfit outfit = getOutfit();
            outfit.setAddons(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-mount") {
            Outfit outfit = getOutfit();
            outfit.setMount(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-wings") {
            Outfit outfit = getOutfit();
            outfit.setWings(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-aura") {
            Outfit outfit = getOutfit();
            outfit.setAura(node->value<int>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-shader") {
            Outfit outfit = getOutfit();
            outfit.setShader(node->value<std::string>());
            setOutfit(outfit);
        } else if (node->tag() == "outfit-center") {
            setCenter(node->value<bool>());
        } else if (node->tag() == "scale") {
            setScale(node->value<float>());
        } else if (node->tag() == "animate") {
            setAnimate(node->value<bool>());
        } else if (node->tag() == "old-scaling") {
            setOldScaling(node->value<bool>());
        }
    }
}

void UICreature::onGeometryChange(const Rect& oldRect, const Rect& newRect)
{
    UIWidget::onGeometryChange(oldRect, newRect);
}

void UICreature::setCenter(bool value)
{
    m_centered = value;
}
